// 메이플스토리 API 설정
const API_KEY = 'live_4db3e15b6ee6c827e4d046182eb283a71687fd0cb8723cd0b96cf76d63246f16efe8d04e6d233bd35cf2fabdeb93fb0d';
const API_BASE_URL = 'https://open.api.nexon.com/maplestory/v1';

// 로컬 스토리지 키
const STORAGE_KEY = 'maplestory_characters';

// 캐릭터 목록 로드
let characters = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

// DOM 요소
const characterInput = document.getElementById('characterInput');
const addButton = document.getElementById('addButton');
const charactersDiv = document.getElementById('characters');
const characterDetail = document.getElementById('characterDetail');
const detailContent = document.getElementById('detailContent');
const closeButton = document.getElementById('closeButton');

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    renderCharacters();
    
    addButton.addEventListener('click', addCharacter);
    characterInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addCharacter();
    });
    
    closeButton.addEventListener('click', () => {
        characterDetail.classList.remove('active');
    });
    
    characterDetail.addEventListener('click', (e) => {
        if (e.target === characterDetail) {
            characterDetail.classList.remove('active');
        }
    });
});

// 캐릭터 추가
async function addCharacter() {
    const characterName = characterInput.value.trim();
    
    if (!characterName) {
        alert('캐릭터 이름을 입력해주세요.');
        return;
    }
    
    // 중복 체크
    if (characters.find(c => c.name === characterName)) {
        alert('이미 추가된 캐릭터입니다.');
        return;
    }
    
    try {
        addButton.disabled = true;
        addButton.textContent = '추가 중...';
        
        // OCID 조회
        const ocid = await getCharacterOcid(characterName);
        
        // 기본 정보 조회
        const basicInfo = await getCharacterBasic(ocid);
        
        // 캐릭터 저장
        characters.push({
            name: characterName,
            ocid: ocid,
            level: basicInfo.character_level,
            class: basicInfo.character_class,
            world: basicInfo.world_name,
            guild: basicInfo.character_guild_name || '없음',
            image: basicInfo.character_image || null,
            exp: basicInfo.character_exp_rate || '0',
            dateCreate: basicInfo.character_date_create || null,
            dateLastLogin: basicInfo.character_date_last_login || null,
            dateLastLogout: basicInfo.character_date_last_logout || null
        });
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(characters));
        renderCharacters();
        
        characterInput.value = '';
        alert(`${characterName} 캐릭터가 추가되었습니다!`);
        
    } catch (error) {
        console.error('Error:', error);
        alert(`캐릭터 추가 실패: ${error.message}`);
    } finally {
        addButton.disabled = false;
        addButton.textContent = '추가';
    }
}

// 캐릭터 목록 렌더링
function renderCharacters() {
    charactersDiv.innerHTML = '';
    
    if (characters.length === 0) {
        charactersDiv.innerHTML = '<p style="color: #999; text-align: center; padding: 40px;">캐릭터를 추가해주세요.</p>';
        return;
    }
    
    characters.forEach((character, index) => {
        const card = document.createElement('div');
        card.className = 'character-card';
        card.innerHTML = `
            ${character.image ? `<img src="${character.image}" alt="${character.name}" class="character-image">` : ''}
            <h3>${character.name}</h3>
            <div class="level">Lv. ${character.level} (${character.exp || '0'}%)</div>
            <div class="level">${character.class}</div>
            <div class="level">${character.world}</div>
            <button class="delete-btn" onclick="deleteCharacter(${index}); event.stopPropagation();">삭제</button>
        `;
        
        card.addEventListener('click', () => showCharacterDetail(character));
        charactersDiv.appendChild(card);
    });
}

// 캐릭터 삭제
function deleteCharacter(index) {
    if (confirm(`${characters[index].name} 캐릭터를 삭제하시겠습니까?`)) {
        characters.splice(index, 1);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(characters));
        renderCharacters();
    }
}

// 캐릭터 상세 정보 표시
async function showCharacterDetail(character) {
    characterDetail.classList.add('active');
    detailContent.innerHTML = '<div class="loading">로딩 중...</div>';
    
    try {
        // 모든 정보 동시 조회
        const [stat, equipment, propensity, hyperstat, ability, union, dojang, vmatrix, hexa] = await Promise.all([
            getCharacterStat(character.ocid),
            getCharacterEquipment(character.ocid),
            getCharacterPropensity(character.ocid),
            getCharacterHyperStat(character.ocid),
            getCharacterAbility(character.ocid),
            getCharacterUnion(character.ocid),
            getCharacterDojang(character.ocid),
            getCharacterVMatrix(character.ocid),
            getCharacterHexa(character.ocid)
        ]);
        
        // HTML 생성
        let html = `
            <div class="stat-section">
                <h2>${character.name}</h2>
                <p>Lv. ${character.level} | ${character.class} | ${character.world}</p>
                <p>길드: ${character.guild}</p>
        `;
        
        // 플레이 기간 정보 추가
        if (character.dateCreate) {
            const createDate = new Date(character.dateCreate);
            const now = new Date();
            const daysPassed = Math.floor((now - createDate) / (1000 * 60 * 60 * 24));
            const years = Math.floor(daysPassed / 365);
            const months = Math.floor((daysPassed % 365) / 30);
            const days = daysPassed % 30;
            
            let playPeriod = '';
            if (years > 0) playPeriod += `${years}년 `;
            if (months > 0) playPeriod += `${months}개월 `;
            if (days > 0 || playPeriod === '') playPeriod += `${days}일`;
            
            html += `<p>📅 플레이 기간: ${playPeriod} (${createDate.toLocaleDateString('ko-KR')} ~)</p>`;
        }
        
        if (character.dateLastLogin) {
            const lastLogin = new Date(character.dateLastLogin);
            html += `<p>🕐 마지막 접속: ${lastLogin.toLocaleString('ko-KR')}</p>`;
        }
        
        // 총 플레이 시간 표시
        if (propensity && propensity.character_playtime) {
            const minutes = parseInt(propensity.character_playtime);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            const remainHours = hours % 24;
            const remainMinutes = minutes % 60;
            
            html += `<p>⏱️ 총 플레이 시간: ${days}일 ${remainHours}시간 ${remainMinutes}분</p>`;
        }
        
        html += `</div>`;
        
        // 환산 주스탯 계산 및 표시
        if (stat && stat.final_stat) {
            const statMap = {};
            stat.final_stat.forEach(s => {
                statMap[s.stat_name] = parseFloat(s.stat_value.replace(/[^0-9.-]/g, '')) || 0;
            });
            
            const mainStat = Math.max(
                statMap['STR'] || 0,
                statMap['DEX'] || 0,
                statMap['INT'] || 0,
                statMap['LUK'] || 0
            );
            
            const attackPower = Math.max(statMap['공격력'] || 0, statMap['마력'] || 0);
            const damage = statMap['데미지'] || 0;
            const bossDamage = statMap['보스 몬스터 데미지'] || 0;
            const ignoreDefense = statMap['방어율 무시'] || 0;
            const critDamage = statMap['크리티컬 데미지'] || 0;
            
            // 환산 주스탯 계산
            const ignoreDefenseCalc = 1 - Math.pow(1 - ignoreDefense / 100, 1);
            const convertedStat = mainStat * 
                (1 + attackPower / 100) * 
                (1 + damage / 100) * 
                (1 + bossDamage / 100) * 
                (1 + ignoreDefenseCalc) * 
                (1 + critDamage / 100);
            
            html += `
                <div class="stat-section highlight-section">
                    <h3>🔥 환산 주스탯</h3>
                    <div class="converted-stat">${Math.floor(convertedStat).toLocaleString()}</div>
                    <div class="stat-breakdown">
                        <div>주스탯: ${Math.floor(mainStat).toLocaleString()}</div>
                        <div>공/마: ${Math.floor(attackPower).toLocaleString()}</div>
                        <div>데미지: ${damage.toFixed(1)}%</div>
                        <div>보공: ${bossDamage.toFixed(1)}%</div>
                        <div>방무: ${ignoreDefense.toFixed(1)}%</div>
                        <div>크뎀: ${critDamage.toFixed(1)}%</div>
                    </div>
                </div>
            `;
        }
        
        // 유니온 정보
        if (union) {
            html += `
                <div class="stat-section">
                    <h3>🏆 유니온</h3>
                    <div class="union-info">
                        <div class="union-level">유니온 레벨: ${union.union_level || 0}</div>
                        <div class="union-grade">${union.union_grade || '-'}</div>
                    </div>
                </div>
            `;
        }
        
        // 무릉도장 기록
        if (dojang && dojang.dojang_best_floor) {
            html += `
                <div class="stat-section">
                    <h3>🥋 무릉도장 최고 기록</h3>
                    <div class="dojang-record">${dojang.dojang_best_floor}층 (${dojang.date_dojang_record || '-'})</div>
                </div>
            `;
        }
        
        // 하이퍼스탯
        if (hyperstat && hyperstat.hyper_stat_preset_1) {
            html += `
                <div class="stat-section">
                    <h3>💎 하이퍼스탯</h3>
                    <div class="stat-grid">
            `;
            
            hyperstat.hyper_stat_preset_1.forEach(h => {
                if (h.stat_level > 0) {
                    html += `
                        <div class="stat-item">
                            <strong>${h.stat_type}</strong>
                            <span>Lv.${h.stat_level} (+${h.stat_increase})</span>
                        </div>
                    `;
                }
            });
            
            html += '</div></div>';
        }
        
        // 어빌리티
        if (ability && ability.ability_info) {
            html += `
                <div class="stat-section">
                    <h3>✨ 어빌리티 (${ability.ability_grade || '-'})</h3>
                    <div class="ability-list">
            `;
            
            ability.ability_info.forEach(a => {
                html += `<div class="ability-item">${a.ability_value}</div>`;
            });
            
            html += '</div></div>';
        }
        
        // HEXA 스탯
        if (hexa && hexa.character_hexa_stat_core) {
            html += `
                <div class="stat-section">
                    <h3>🌟 HEXA 스탯</h3>
                    <div class="stat-grid">
            `;
            
            hexa.character_hexa_stat_core.forEach(h => {
                html += `
                    <div class="stat-item">
                        <strong>${h.stat_type || h.hexa_stat_grade}</strong>
                        <span>Lv.${h.stat_level || 0}</span>
                    </div>
                `;
            });
            
            html += '</div></div>';
        }
        
        // V매트릭스
        if (vmatrix && vmatrix.character_v_core_equipment) {
            const cores = vmatrix.character_v_core_equipment.slice(0, 6);
            html += `
                <div class="stat-section">
                    <h3>⚡ V매트릭스</h3>
                    <div class="vmatrix-grid">
            `;
            
            cores.forEach(core => {
                html += `
                    <div class="vmatrix-item">
                        <div>${core.slot_id}번 슬롯</div>
                        <div class="core-level">Lv.${core.slot_level}</div>
                    </div>
                `;
            });
            
            html += '</div></div>';
        }
        
        // 장비 정보 표시
        if (equipment && equipment.item_equipment) {
            html += '<div class="stat-section"><h3>🎽 장착 장비</h3>';
            
            const equipmentSlots = [
                { key: 'item_equipment', title: '일반 장비' },
                { key: 'cash_item_equipment', title: '캐시 장비' },
                { key: 'symbol_equipment', title: '심볼' }
            ];
            
            equipmentSlots.forEach(slot => {
                const items = equipment[slot.key];
                if (items && items.length > 0) {
                    html += `<h4 style="margin-top: 20px; color: #764ba2;">${slot.title}</h4>`;
                    html += '<div class="equipment-grid">';
                    
                    items.forEach(item => {
                        html += `
                            <div class="equipment-item">
                                <div class="equipment-name">${item.item_name}</div>
                                <div class="equipment-info">
                                    <small>${item.item_equipment_part || item.item_equipment_slot || ''}</small>
                                `;
                        
                        // 강화 수치 표시
                        if (item.scroll_upgrade) {
                            html += `<small> | 업그레이드: ${item.scroll_upgrade}</small>`;
                        }
                        if (item.starforce) {
                            html += `<small> | ⭐ ${item.starforce}</small>`;
                        }
                        if (item.potential_option_grade) {
                            html += `<small> | 잠재: ${item.potential_option_grade}</small>`;
                        }
                        
                        html += `
                                </div>
                            </div>
                        `;
                    });
                    
                    html += '</div>';
                }
            });
            
            html += '</div>';
        }
        
        // 스탯 정보 표시
        if (stat && stat.final_stat) {
            html += '<div class="stat-section"><h3>⚔️ 스탯 정보</h3><div class="stat-grid">';
            
            stat.final_stat.forEach(s => {
                html += `
                    <div class="stat-item">
                        <strong>${s.stat_name}</strong>
                        <span>${s.stat_value}</span>
                    </div>
                `;
            });
            
            html += '</div></div>';
        }
        
        detailContent.innerHTML = html;
        
    } catch (error) {
        console.error('Error:', error);
        detailContent.innerHTML = `<div class="error">정보를 불러오는데 실패했습니다: ${error.message}</div>`;
    }
}

// API 호출 함수들

// OCID 조회
async function getCharacterOcid(characterName) {
    const response = await fetch(
        `${API_BASE_URL}/id?character_name=${encodeURIComponent(characterName)}`,
        {
            headers: {
                'x-nxopen-api-key': API_KEY
            }
        }
    );
    
    if (!response.ok) {
        throw new Error('캐릭터를 찾을 수 없습니다.');
    }
    
    const data = await response.json();
    return data.ocid;
}

// 캐릭터 기본 정보
async function getCharacterBasic(ocid) {
    const response = await fetch(
        `${API_BASE_URL}/character/basic?ocid=${ocid}`,
        {
            headers: {
                'x-nxopen-api-key': API_KEY
            }
        }
    );
    
    if (!response.ok) {
        throw new Error('캐릭터 정보를 가져올 수 없습니다.');
    }
    
    return await response.json();
}

// 캐릭터 스탯 정보
async function getCharacterStat(ocid) {
    const response = await fetch(
        `${API_BASE_URL}/character/stat?ocid=${ocid}`,
        {
            headers: {
                'x-nxopen-api-key': API_KEY
            }
        }
    );
    
    if (!response.ok) {
        throw new Error('스탯 정보를 가져올 수 없습니다.');
    }
    
    return await response.json();
}

// 캐릭터 장비 정보
async function getCharacterEquipment(ocid) {
    const response = await fetch(
        `${API_BASE_URL}/character/item-equipment?ocid=${ocid}`,
        {
            headers: {
                'x-nxopen-api-key': API_KEY
            }
        }
    );
    
    if (!response.ok) {
        throw new Error('장비 정보를 가져올 수 없습니다.');
    }
    
    return await response.json();
}

// 캐릭터 성향 정보 (플레이 시간 포함)
async function getCharacterPropensity(ocid) {
    const response = await fetch(
        `${API_BASE_URL}/character/propensity?ocid=${ocid}`,
        {
            headers: {
                'x-nxopen-api-key': API_KEY
            }
        }
    );
    
    if (!response.ok) {
        return null;
    }
    
    return await response.json();
}

// 하이퍼스탯 정보
async function getCharacterHyperStat(ocid) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/character/hyper-stat?ocid=${ocid}`,
            {
                headers: {
                    'x-nxopen-api-key': API_KEY
                }
            }
        );
        
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

// 어빌리티 정보
async function getCharacterAbility(ocid) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/character/ability?ocid=${ocid}`,
            {
                headers: {
                    'x-nxopen-api-key': API_KEY
                }
            }
        );
        
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

// 유니온 정보
async function getCharacterUnion(ocid) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/user/union?ocid=${ocid}`,
            {
                headers: {
                    'x-nxopen-api-key': API_KEY
                }
            }
        );
        
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

// 무릉도장 정보
async function getCharacterDojang(ocid) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/character/dojang?ocid=${ocid}`,
            {
                headers: {
                    'x-nxopen-api-key': API_KEY
                }
            }
        );
        
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

// V매트릭스 정보
async function getCharacterVMatrix(ocid) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/character/v-matrix?ocid=${ocid}`,
            {
                headers: {
                    'x-nxopen-api-key': API_KEY
                }
            }
        );
        
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

// HEXA 정보
async function getCharacterHexa(ocid) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/character/hexamatrix-stat?ocid=${ocid}`,
            {
                headers: {
                    'x-nxopen-api-key': API_KEY
                }
            }
        );
        
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}
