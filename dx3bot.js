// 필요한 모듈 가져오기
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Events } = require('discord.js');
require('dotenv').config();

// 환경 변수 검증
const token = process.env.DISCORD_BOT_TOKEN;
const BOT_OWNER_ID = process.env.BOT_OWNER_ID;

if (!token) {
    console.error("❌ DISCORD_BOT_TOKEN 환경 변수가 설정되지 않았습니다!");
    process.exit(1);
}

// 파일 경로 설정
const dataFilePath = path.join(__dirname, 'data.json');
const versionFilePath = path.join(__dirname, 'version.json');
const activeCharacterFile = path.join(__dirname, 'active_character.json');
const comboDataFile = path.join(__dirname, 'comboData.json');

// 디스코드 클라이언트 설정
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

// ==================== 데이터 관리 함수 ====================

// 데이터 로드/저장 함수
const loadData = () => {
    if (!fs.existsSync(dataFilePath)) {
        fs.writeFileSync(dataFilePath, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
};

const saveData = (data) => {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
};

// 버전 관리 함수
const loadVersion = () => {
    if (!fs.existsSync(versionFilePath)) {
        return { major: 1, minor: 0, patch: 0 };
    }
    return JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));
};

const saveVersion = (versionData) => {
    fs.writeFileSync(versionFilePath, JSON.stringify(versionData, null, 2));
};

// 활성 캐릭터 관리 함수
const loadActiveCharacter = () => {
    if (!fs.existsSync(activeCharacterFile)) {
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(activeCharacterFile, 'utf8'));
    } catch (error) {
        console.error('❌ 활성 캐릭터 데이터를 불러오는 중 오류 발생:', error);
        return {};
    }
};

const saveActiveCharacterData = (activeCharacter) => {
    fs.writeFileSync(activeCharacterFile, JSON.stringify(activeCharacter, null, 2));
};

// 콤보 데이터 관리 함수
const loadComboData = () => {
    if (!fs.existsSync(comboDataFile)) {
        return {};
    }
    return JSON.parse(fs.readFileSync(comboDataFile, 'utf8'));
};

const saveComboData = (comboData) => {
    fs.writeFileSync(comboDataFile, JSON.stringify(comboData, null, 2));
};

// ==================== 전역 변수 초기화 ====================

let currentVersion = loadVersion();
let activeCharacter = loadActiveCharacter();
let comboData = loadComboData();
let erosionRequesters = {}; // 등장침식 요청자 추적

// ==================== 상수 및 매핑 ====================

const syndromeTranslation = {
    "엔젤헤일로": "ANGEL HALO", "발로르": "BALOR", "블랙독": "BLACK DOG",
    "브람스토커": "BRAM STOKER", "키마이라": "CHIMAERA", "엑자일": "EXILE",
    "하누만": "HANUMAN", "모르페우스": "MORPHEUS", "노이만": "NEUMANN",
    "오르쿠스": "ORCUS", "샐러맨더": "SALAMANDRA", "솔라리스": "SOLARIS",
    "우로보로스": "OUROBOROS", "아자토스": "AZATHOTH", "미스틸테인": "MISTILTEN",
    "글레이프닐": "GLEIPNIR"
};

const mainAttributes = ['육체', '감각', '정신', '사회'];

const subToMainMapping = {
    '백병': '육체', '회피': '육체', '사격': '감각', '지각': '감각',
    'RC': '정신', '의지': '정신', '교섭': '사회', '조달': '사회',
};

const dynamicMappingRules = {
    '운전:': '육체', '정보:': '사회', '예술:': '감각', '지식:': '정신',
};

// ==================== 유틸리티 함수 ====================

const convertSyndromeToEnglish = (syndrome) => {
    return (syndromeTranslation[syndrome] || syndrome).toUpperCase();
};

const extractComboName = (input) => {
    let match = input.match(/^["'\[](.*?)["'\]]$/);
    return match ? match[1] : input;
};

const extractLoisName = (input) => {
    let match = input.match(/^["'\[](.*?)["'\]]$/);
    return match ? match[1] : input;
};

const getActiveCharacter = (serverId, userId) => {
    return serverId ? activeCharacter[serverId]?.[userId] : activeCharacter[userId];
};

const updateCharacterAttribute = (message, attribute, value) => {
    const serverId = message.guild?.id;
    const userId = message.author.id;
    const activeCharName = getActiveCharacter(serverId, userId);
    const data = loadData();

    if (!activeCharName || !validateCharacterData(data, serverId, userId, activeCharName)) {
        return message.channel.send(`${message.author.tag}님, 활성화된 캐릭터가 없습니다. \`!지정 [캐릭터 이름]\` 명령어로 캐릭터를 지정해주세요.`);
    }

    if (serverId) {
        data[serverId][userId][activeCharName][attribute] = value;
    } else {
        data[userId][activeCharName][attribute] = value;
    }
    saveData(data);

    return message.channel.send(`✅ **${activeCharName}**의 **${attribute}**이(가) **"${value}"**(으)로 설정되었습니다.`);
};

const validateCharacterData = (data, serverId, userId, characterName) => {
    if (serverId) {
        return data[serverId]?.[userId]?.[characterName];
    } else {
        return data[userId]?.[characterName];
    }
};

const updateErosionD = (characterData, currentErosion) => {
    let currentChimiskD = characterData['침식D'] || 0;
    let newChimiskD = currentChimiskD;
    let messages = [];

    const thresholds = [
        { erosion: 60, chimiskD: 1 },
        { erosion: 80, chimiskD: 2 },
        { erosion: 100, chimiskD: 3 },
        { erosion: 130, chimiskD: 4 },
        { erosion: 190, chimiskD: 5 }
    ];

    for (let threshold of thresholds) {
        if (currentErosion >= threshold.erosion && currentChimiskD < threshold.chimiskD) {
            newChimiskD = threshold.chimiskD;
            messages.push(`⚠️ 침식률이 ${threshold.erosion}을 넘어서 **침식D가 ${threshold.chimiskD}**로 상승했습니다.`);
        }
    }

    if (newChimiskD > currentChimiskD) {
        characterData['침식D'] = newChimiskD;
    }

    return messages;
};

// ==================== 봇 이벤트 핸들러 ====================

client.once(Events.ClientReady, readyClient => {
    console.log(`✅ Logged in as ${readyClient.user.tag}!`);
});

// ==================== 메인 명령어 처리 ====================

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const serverId = message.guild.id;
    const userId = message.author.id;
    const data = loadData();

    try {
        // ==================== 업데이트 명령어 ====================
        if (message.content.startsWith('!업데이트')) {
            if (message.author.id !== BOT_OWNER_ID) {
                return message.channel.send("❌ 이 명령어는 봇 소유자만 사용할 수 있습니다.");
            }

            let args = message.content.split(' ').slice(1);
            let updateType = args[0] || "patch";
            let announcementMessage = args.slice(1).join(' ');

            if (updateType === "major") {
                currentVersion.major += 1;
                currentVersion.minor = 0;
                currentVersion.patch = 0;
            } else if (updateType === "minor") {
                currentVersion.minor += 1;
                currentVersion.patch = 0;
            } else {
                currentVersion.patch += 1;
            }

            saveVersion(currentVersion);

            let newVersion = `v${currentVersion.major}.${currentVersion.minor}.${currentVersion.patch}`;
            let finalMessage = `📢 **DX3bot 업데이트: ${newVersion}**\n${announcementMessage || "새로운 기능이 추가되었습니다!"}`;

            // 모든 서버에 공지 전송
            client.guilds.cache.forEach((guild) => {
                try {
                    guild.fetchOwner()
                        .then(owner => {
                            if (owner) {
                                owner.send(finalMessage)
                                    .then(() => console.log(`📩 서버 "${guild.name}"의 관리자에게 업데이트 공지를 전송했습니다.`))
                                    .catch(err => console.error(`❌ 서버 관리자 DM 전송 실패 (${guild.name}):`, err));
                            }
                        })
                        .catch(err => console.error(`⚠️ 서버 "${guild.name}"의 관리자 정보를 가져올 수 없습니다.`, err));
                } catch (error) {
                    console.error(`❌ 서버 "${guild.name}"에 공지를 보내는 중 오류 발생:`, error);
                }
            });

            // 봇 소유자에게도 DM 전송
            client.users.fetch(BOT_OWNER_ID)
                .then(botOwner => {
                    if (botOwner) {
                        botOwner.send(finalMessage)
                            .then(() => console.log(`📩 봇 소유자(${botOwner.tag})에게 업데이트 공지를 DM으로 보냈습니다.`))
                            .catch(err => console.error("❌ 봇 소유자 DM 전송 실패:", err));
                    }
                })
                .catch(err => console.error("❌ 봇 소유자 정보 가져오기 실패:", err));

            message.channel.send(`✅ **업데이트 완료! 현재 버전: ${newVersion}**`);
        }

        // ==================== 도움말 명령어 ====================
        else if (message.content.startsWith('!도움')) {
            const embeds = [
                {
                    color: 0x0099ff,
                    title: '📖 DX3bot 명령어 목록 (1/3)',
                    description: 'DX3bot의 주요 기능을 안내합니다.',
                    fields: [
                        {
                            name: '📌 **캐릭터 관리**',
                            value: '> `!시트입력` `"캐릭터 이름"` 항목1 값1 항목2 값2 ...  \n' +
                                   '> 새로운 캐릭터를 등록하거나 기존 캐릭터 정보를 수정합니다.\n' +
                                   '> **예시:** `!시트입력 "캐릭터 이름" 육체 3 감각 6`  \n' +
                                   '> `!지정` `"캐릭터 이름"` - 특정 캐릭터를 활성화합니다.  \n' +
                                   '> `!지정해제` - 현재 활성화된 캐릭터를 해제합니다.  \n' +
                                   '> `!시트확인` - 현재 활성 캐릭터의 정보를 확인합니다.'
                        },
                        {
                            name: '📌 **상태 변경**',
                            value: '> `!침식률+N`, `!HP-10`  \n' +
                                   '> 특정 능력치 값을 증가/감소/설정합니다.  \n' +
                                   '> **예시:** `!침식률+5`'
                        },
                        {
                            name: '🎲 **판정 시스템**',
                            value: '> `!판정` `[항목]` - 해당 능력으로 주사위를 굴립니다.  \n' +
                                   '> 침식D가 자동 적용됩니다.  \n' +
                                   '> **예시:** `!판정 백병`'
                        },
                        {
                            name: '⚔ **등장 침식**',
                            value: '> `!등침`, `!등장침식` - 등장 시 `1d10`을 굴려 침식률을 추가합니다.'
                        }
                    ],
                },
                {
                    color: 0x0099ff,
                    title: '📖 DX3bot 명령어 목록 (2/3)',
                    fields: [
                        {
                            name: '🎭 **캐릭터 상세 설정**',
                            value: '> `!이모지` `[이모지]` - 캐릭터의 이모지를 설정합니다.  \n' +
                                   '> `!커버` `[이름]` - 캐릭터의 커버를 설정합니다.  \n' +
                                   '> `!웍스` `[이름]` - 캐릭터의 웍스를 설정합니다.  \n' +
                                   '> `!브리드` `[퓨어/크로스/트라이]` - 브리드를 설정합니다.  \n' +
                                   '> `!신드롬` `[신드롬1]` `[신드롬2]` `[신드롬3]` - 신드롬을 설정합니다.  \n' +
                                   '> `!각성` `[이름]` - 캐릭터의 각성을 설정합니다.  \n' +
                                   '> `!충동` `[이름]` - 캐릭터의 충동을 설정합니다.  \n' +
                                   '> `!D로` `[번호]` `[이름]` - D-Lois를 설정합니다.  \n' +
                                   '> **예시:** `!D로 98 Legacy: Dream of Abyssal City`'
                        },
                        {
                            name: '⚔ **콤보 시스템**',
                            value: '> `!콤보` `"콤보 이름"` `[침식률 조건]` `[콤보 데이터]`  \n' +
                                   '> 특정 침식률에 따라 콤보를 저장합니다.  \n' +
                                   '> **침식률 조건 작성법:**  \n' +
                                   '> - `99↓` : 침식률이 **99 이하**일 때 적용  \n' +
                                   '> - `100↑` : 침식률이 **100 이상**일 때 적용  \n' +
                                   '> - `130↑` : 침식률이 **130 이상**일 때 적용  \n' +
                                   '> **예시:** `!콤보 "연속 사격" 99↓ 《C: 발로르(2) + 흑의 철퇴(4)》`  \n' +
                                   '> `!@"콤보 이름"` - 침식률에 맞는 콤보를 자동 검색 후 출력  \n' +
                                   '> `!콤보삭제` `"콤보 이름"` - 특정 콤보를 삭제합니다.'
                        }
                    ]
                },
                {
                    color: 0x0099ff,
                    title: '📖 DX3bot 명령어 목록 (3/3)',
                    fields: [
                        {
                            name: '🔹 **로이스 시스템**',
                            value: '> `!로이스` `"이름"` `[P감정]` `[N감정]` `[내용]` - 새로운 로이스를 추가합니다.  \n' +
                                   '> **P 감정을 강조하려면 감정 뒤에 `*`을 추가하세요.**  \n' +
                                   '> **예시:** `!로이스 "배신자" 증오* 분노 나를 배신한 동료`  \n' +
                                   '> **출력 예시:**  \n' +
                                   '> > **배신자** | 【P: 증오】 / N: 분노 | 나를 배신한 동료  \n' +
                                   '> `!로이스삭제` `"이름"` - 해당 로이스 삭제  \n' +
                                   '> `!타이터스` `"이름"` - 해당 로이스를 타이터스로 변환'
                        },
                        {
                            name: '🔧 **관리 명령어**',
                            value: '> `!리셋` - 현재 캐릭터의 모든 데이터를 초기화합니다.  \n' +
                                   '> `!리셋 콤보` - 콤보 데이터만 초기화  \n' +
                                   '> `!리셋 로이스` - 로이스 데이터만 초기화  \n' +
                                   '> `!캐릭터삭제` `"이름"` - 특정 캐릭터 데이터를 삭제'
                        }
                    ],
                    footer: { text: '📌 이상이 있다면 언제든 오샤(@TRPG_sha)로 DM 해주세요!' }
                }
            ];

            for (const embed of embeds) {
                await message.channel.send({ embeds: [embed] });
            }
        }

        // ==================== 시트입력 명령어 ====================
        else if (message.content.startsWith('!시트입력')) {
            const regex = /^!시트입력\s+(?:"([^"]+)"|\[([^\]]+)\]|(\S+))\s+(.+)$/;
            const match = message.content.match(regex);

            if (!match) {
                return message.channel.send('❌ 사용법: `!시트입력 "캐릭터 이름" [항목1] [값1] [항목2] [값2] ...`\n📌 **예시:** `!시트입력 "와타누키 유우" HP 24 침식률 30 육체 1 백병 1`');
            }

            const characterName = match[1] || match[2] || match[3];
            const args = match[4].split(/\s+/);
            if (args.length < 2 || args.length % 2 !== 0) {
                return message.channel.send('❌ 속성은 최소한 하나 이상 입력해야 하며, 속성과 값은 짝수여야 합니다.\n📌 **예시:** `!시트입력 "캐릭터 이름" HP 24 침식률 30 육체 1`');
            }

            if (!data[serverId]) data[serverId] = {};
            if (!data[serverId][userId]) data[serverId][userId] = {};
            if (!data[serverId][userId][characterName]) data[serverId][userId][characterName] = {};

            let updatedAttributes = [];
            let currentErosion = 0;

            for (let i = 0; i < args.length; i += 2) {
                const attribute = args[i];
                const value = parseInt(args[i + 1]);

                if (isNaN(value)) {
                    return message.channel.send(`❌ **${args[i + 1]}**는 숫자가 아닙니다. 숫자 값만 입력해주세요.`);
                }

                data[serverId][userId][characterName][attribute] = value;
                updatedAttributes.push(`${attribute}: ${value}`);

                // 침식률이 설정된 경우 추적
                if (attribute === '침식률') {
                    currentErosion = value;
                }
            }

            // 침식률이 설정된 경우 침식D 자동 계산
            if (currentErosion > 0) {
                const characterData = data[serverId][userId][characterName];
                const erosionMessages = updateErosionD(characterData, currentErosion);
                
                // 침식D가 업데이트된 경우 알림
                if (erosionMessages.length > 0) {
                    updatedAttributes.push(`침식D: ${characterData.침식D}`);
                }
            }

            saveData(data);
            
            let response = `✅ **${characterName}**의 항목이 설정되었습니다.\n`;
            response += `📊 **설정된 항목:** ${updatedAttributes.join(', ')}`;
            
            message.channel.send(response);
        }

        // ==================== 캐릭터 지정/해제 명령어 ====================
        else if (message.content === '!지정해제') {
            if (!activeCharacter[serverId] || !activeCharacter[serverId][userId]) {
                return message.reply("❌ 현재 활성화된 캐릭터가 없습니다.");
            }

            const prevCharacter = activeCharacter[serverId][userId];
            delete activeCharacter[serverId][userId];

            saveActiveCharacterData(activeCharacter);
            return message.channel.send(`✅ **${prevCharacter}**님을 활성 캐릭터에서 해제했습니다.`);
        }

        else if (message.content.startsWith('!지정 ')) {
            const match = message.content.match(/"([^"]+)"|\S+/g);
            if (!match || match.length < 2) {
                return message.channel.send('❌ 사용법: `!지정 "캐릭터 이름"`');
            }

            const characterName = match.slice(1).join(' ').replace(/"/g, '');

            if (!data[serverId] || !data[serverId][userId] || !data[serverId][userId][characterName]) {
                return message.channel.send(`❌ 캐릭터 "${characterName}"의 데이터를 찾을 수 없습니다. 먼저 \`!시트입력\`을 사용하여 캐릭터를 등록하세요.`);
            }

            if (!activeCharacter[serverId]) activeCharacter[serverId] = {};
            activeCharacter[serverId][userId] = characterName;

            saveActiveCharacterData(activeCharacter);
            return message.channel.send(`✅ **${characterName}**님을 활성 캐릭터로 지정했습니다.`);
        }

        // ==================== 캐릭터 속성 설정 명령어 ====================
        else if (message.content.startsWith('!코드네임')) {
            const match = message.content.match(/^!코드네임\s+(?:"([^"]+)"|\[([^\]]+)\]|(.+))$/);
            if (!match) {
                return message.channel.send('❌ 사용법: `!코드네임 "코드네임"` 또는 `!코드네임 [코드네임]`');
            }
            const characterCodeName = match[1] || match[2] || match[3];
            updateCharacterAttribute(message, 'codeName', characterCodeName);
        }

        else if (message.content.startsWith('!이모지')) {
            const args = message.content.split(' ').slice(1);
            if (args.length < 1) {
                return message.channel.send('❌ 사용법: `!이모지 [이모지]`');
            }
            updateCharacterAttribute(message, 'emoji', args[0]);
        }

        else if (message.content.startsWith('!커버')) {
            const args = message.content.split(' ').slice(1).join(' ');
            if (!args) return message.channel.send('❌ 사용법: `!커버 [이름]`');
            updateCharacterAttribute(message, 'cover', args);
        }

        else if (message.content.startsWith('!웍스')) {
            const args = message.content.split(' ').slice(1).join(' ');
            if (!args) return message.channel.send('❌ 사용법: `!웍스 [이름]`');
            updateCharacterAttribute(message, 'works', args);
        }

        else if (message.content.startsWith('!브리드')) {
            const args = message.content.split(' ').slice(1).join(' ');
            if (!args) return message.channel.send('❌ 사용법: `!브리드 [이름]`');
            updateCharacterAttribute(message, 'breed', args);
        }

        else if (message.content.startsWith('!신드롬')) {
            const args = message.content.split(' ').slice(1);
            if (args.length < 1 || args.length > 3) {
                return message.channel.send('❌ 사용법: `!신드롬 [신드롬1] [신드롬2] [신드롬3]` (최대 3개)');
            }
            const translatedSyndromes = args.map(convertSyndromeToEnglish).join(" × ");
            updateCharacterAttribute(message, 'syndromes', translatedSyndromes);
        }

        else if (message.content.startsWith('!각성')) {
            const args = message.content.split(' ').slice(1).join(' ');
            if (!args) return message.channel.send('❌ 사용법: `!각성 [이름]`');
            updateCharacterAttribute(message, 'awakening', args);
        }

        else if (message.content.startsWith('!충동')) {
            const args = message.content.split(' ').slice(1).join(' ');
            if (!args) return message.channel.send('❌ 사용법: `!충동 [이름]`');
            updateCharacterAttribute(message, 'impulse', args);
        }

        else if (message.content.startsWith('!D로')) {
            const args = message.content.split(' ').slice(1);
            if (args.length < 2) {
                return message.channel.send('❌ 사용법: `!D로 [번호] [이름]`');
            }
            const dloisNo = args[0];
            const dloisName = args.slice(1).join(' ');
            updateCharacterAttribute(message, 'dloisNo', dloisNo);
            updateCharacterAttribute(message, 'dloisName', dloisName);
        }

        // ==================== 시트확인 명령어 ====================
        else if (message.content.startsWith('!시트확인')) {
            const activeCharacterName = activeCharacter[serverId]?.[userId];

            if (!activeCharacterName || !data[serverId] || !data[serverId][userId] || !data[serverId][userId][activeCharacterName]) {
                return message.reply(`❌ 활성화된 캐릭터가 없습니다. \`!지정 [캐릭터 이름]\` 명령어로 캐릭터를 지정해주세요.`);
            }

            const characterData = data[serverId][userId][activeCharacterName];
            const characterCodeName = characterData.codeName || '코드네임 없음';

            if (!Array.isArray(characterData.lois)) {
                characterData.lois = [];
            }

            const characterEmoji = characterData.emoji || '❌';

            let breedType = "브리드 없음";
            if (characterData.breed) {
                if (characterData.breed.toLowerCase() === "퓨어") {
                    breedType = "PURE";
                } else if (characterData.breed.toLowerCase() === "크로스") {
                    breedType = "CROSS";
                } else if (characterData.breed.toLowerCase() === "트라이") {
                    breedType = "TRI";
                }
            }

            let syndromeList = characterData.syndromes ? characterData.syndromes.split(" × ") : ["신드롬 없음"];
            syndromeList = syndromeList.map(convertSyndromeToEnglish);

            let response = `${characterEmoji}  **${activeCharacterName}** :: **「${characterCodeName}」**\n`;
            response += `> ${characterData.cover || "커버 없음"}｜${characterData.works || "웍스 없음"}\n`;
            response += `> ${breedType}｜${syndromeList.join(" × ")}\n`;
            response += `> ${characterData.awakening || "각성 없음"}｜${characterData.impulse || "충동 없음"}\n`;
            response += `> D-Lois｜No.${characterData.dloisNo || "00"} ${characterData.dloisName || "D로이스 없음"}\n\n`;

            response += `> **HP** ${characterData.HP || 0}  |  **침식률** ${characterData.침식률 || 0}  |  **침식D** ${characterData.침식D || 0}  |  **로이스** ${characterData.lois.length}\n`;

            // 각 상위 항목에 대해 하위 항목을 찾고 출력
            for (let mainAttr of mainAttributes) {
                let subAttributes = [];
                let mainAttrValue = characterData[mainAttr] || 0;

                for (let [key, value] of Object.entries(characterData)) {
                    if (subToMainMapping[key] === mainAttr) {
                        subAttributes.push(`${key}: ${value}`);
                    } else {
                        for (let prefix in dynamicMappingRules) {
                            if (key.startsWith(prefix)) {
                                let detectedMainAttr = dynamicMappingRules[prefix];
                                if (detectedMainAttr === mainAttr) {
                                    subAttributes.push(`${key}: ${value}`);
                                }
                            }
                        }
                    }
                }

                if (subAttributes.length > 0 || mainAttrValue !== 0) {
                    response += `>     **【${mainAttr}】**  ${mainAttrValue}   ` + subAttributes.join(' ') + '\n';
                }
            }

            // 콤보 출력 - 최신 데이터를 파일에서 직접 로드
            const currentComboData = loadComboData();
            if (currentComboData[serverId] && currentComboData[serverId][userId] && currentComboData[serverId][userId][activeCharacterName]) {
                response += `\n${characterEmoji}  **콤보** \n`;
                for (let comboName in currentComboData[serverId][userId][activeCharacterName]) {
                    response += `> ㆍ **${comboName}**\n`;
                }
            }

            // 로이스 출력
            if (characterData.lois && characterData.lois.length > 0) {
                response += `\n${characterEmoji}  **로이스** \n`;
                for (let lois of characterData.lois) {
                    response += `> ㆍ **${lois.name}** | ${lois.pEmotion} / ${lois.nEmotion} | ${lois.description}\n`;
                }
            }

            return message.reply(response);
        }

        // ==================== 판정 명령어 ====================
        else if (message.content.startsWith('!판정')) {
            const args = message.content.split(' ').slice(1);
            if (args.length < 1) {
                return message.channel.send('❌ 사용법: `!판정 [항목]`');
            }

            let attribute = args[0];
            let activeCharacterName = activeCharacter[serverId]?.[userId];

            if (!activeCharacterName) {
                return message.reply(`❌ 활성화된 캐릭터가 없습니다. \`!지정 [캐릭터 이름]\` 명령어로 캐릭터를 지정해주세요.`);
            }

            if (!data[serverId] || !data[serverId][userId] || !data[serverId][userId][activeCharacterName]) {
                return message.channel.send(`❌ **${activeCharacterName}** 캐릭터 데이터를 찾을 수 없습니다.`);
            }

            let characterData = data[serverId][userId][activeCharacterName];

            // 동적 항목이 있는 경우, 상위 항목으로 매핑
            let mainAttr = attribute;
            for (let key in dynamicMappingRules) {
                if (attribute.startsWith(key)) {
                    mainAttr = dynamicMappingRules[key];
                    break;
                }
            }

            for (let key in subToMainMapping) {
                if (attribute.startsWith(key)) {
                    mainAttr = subToMainMapping[key];
                    break;
                }
            }

            const mainValue = characterData[mainAttr] !== undefined ? characterData[mainAttr] : 0;
            const subValue = characterData[attribute] !== undefined ? characterData[attribute] : 0;
            const chimiskD = characterData.침식D || 0;

            if (mainValue !== undefined && subValue !== undefined) {
                const finalMainValue = `(${mainValue}+${chimiskD})dx`;
                const finalResult = `${finalMainValue}+${subValue}`;
                message.channel.send(`${finalResult}  ${attribute} 판정 <@${message.author.id}>`);
            } else {
                message.channel.send(`❌ **${activeCharacterName}**의 \`${attribute}\` 값을 찾을 수 없습니다.`);
            }
        }

        // ==================== 상태 조정 명령어 ====================
        else if (message.content.startsWith('!') && (message.content.includes('+') || message.content.includes('-') || message.content.includes('='))) {
            const statMatch = message.content.match(/^!([가-힣A-Za-z]+)([+=\-]\d+)$/);

            if (statMatch) {
                const statName = statMatch[1];
                const operation = statMatch[2];
                const activeCharacterName = activeCharacter[serverId]?.[userId];

                if (!activeCharacterName || !data[serverId] || !data[serverId][userId] || !data[serverId][userId][activeCharacterName]) {
                    return message.reply(`${message.author.tag}님, 활성화된 캐릭터가 없습니다. \`!지정 [캐릭터 이름]\` 명령어로 캐릭터를 지정해주세요.`);
                }

                if (statName === "로이스") {
                    return message.reply(`'로이스'는 이 명령어로 조정할 수 없습니다. \`!로이스\` 명령어를 사용하세요.`);
                }

                let currentStatus = data[serverId][userId][activeCharacterName];
                let newValue = currentStatus[statName] || 0;

                if (operation.startsWith('+')) {
                    newValue += parseInt(operation.slice(1));
                } else if (operation.startsWith('-')) {
                    newValue -= parseInt(operation.slice(1));
                } else if (operation.startsWith('=')) {
                    newValue = parseInt(operation.slice(1));
                }

                currentStatus[statName] = newValue;

                // 침식률에 따른 침식D 증가 로직
                if (statName === '침식률') {
                    const messages = updateErosionD(currentStatus, newValue);
                    for (const msg of messages) {
                        message.channel.send(msg);
                    }
                }

                saveData(data);

                let updatedStatus = `▶ **${activeCharacterName}**\n현재 **${statName}:** ${newValue}`;
                return message.reply(updatedStatus);
            }
        }

        // ==================== 리셋 명령어 ====================
        else if (message.content.startsWith('!리셋')) {
            const args = message.content.split(' ').slice(1);
            let activeCharacterName = activeCharacter[serverId] && activeCharacter[serverId][userId];

            if (!activeCharacterName) {
                return message.reply(`${message.author.tag}님, 활성화된 캐릭터가 없습니다. \`!지정 ["캐릭터 이름"]\` 명령어로 캐릭터를 지정해주세요.`);
            }

            if (!data[serverId] || !data[serverId][userId] || !data[serverId][userId][activeCharacterName]) {
                return message.reply(`⚠️ **${activeCharacterName}**의 데이터가 존재하지 않습니다.`);
            }

            // 전체 리셋
            if (args.length === 0) {
                delete data[serverId][userId][activeCharacterName];

                if (comboData[serverId] && comboData[serverId][userId] && comboData[serverId][userId][activeCharacterName]) {
                    delete comboData[serverId][userId][activeCharacterName];
                }

                saveData(data);
                saveComboData(comboData);

                return message.channel.send(`✅ **${activeCharacterName}**의 모든 데이터가 초기화되었습니다.`);
            }

            let resetType = args.join(' ').toLowerCase();

            // 콤보 리셋
            if (resetType === "콤보") {
                if (comboData[serverId] && comboData[serverId][userId] && comboData[serverId][userId][activeCharacterName]) {
                    delete comboData[serverId][userId][activeCharacterName];
                    saveComboData(comboData);
                    return message.channel.send(`✅ **${activeCharacterName}**의 모든 콤보가 삭제되었습니다.`);
                } else {
                    return message.channel.send(`⚠️ **${activeCharacterName}**에게 저장된 콤보가 없습니다.`);
                }
            }

            // 로이스 리셋
            if (resetType === "로이스") {
                if (data[serverId][userId][activeCharacterName].lois) {
                    delete data[serverId][userId][activeCharacterName].lois;
                    saveData(data);
                    return message.channel.send(`✅ **${activeCharacterName}**의 모든 로이스가 삭제되었습니다.`);
                } else {
                    return message.channel.send(`⚠️ **${activeCharacterName}**에게 등록된 로이스가 없습니다.`);
                }
            }

            // 특정 속성 리셋
            let statName = resetType;
            if (data[serverId][userId][activeCharacterName][statName] !== undefined) {
                delete data[serverId][userId][activeCharacterName][statName];
                saveData(data);
                return message.channel.send(`✅ **${activeCharacterName}**의 '${statName}' 데이터가 초기화되었습니다.`);
            } else {
                return message.channel.send(`⚠️ **${activeCharacterName}**의 '${statName}' 데이터를 찾을 수 없습니다.`);
            }
        }

        // ==================== 등장침식 명령어 ====================
        else if (message.content.startsWith('!등침') || message.content.startsWith('!등장침식')) {
            let activeCharacterName = activeCharacter[serverId]?.[userId];

            if (!activeCharacterName || !data[serverId] || !data[serverId][userId] || !data[serverId][userId][activeCharacterName]) {
                return message.reply(`${message.author.tag}님, 활성화된 캐릭터가 없습니다. \`!지정 [캐릭터 이름]\` 명령어로 캐릭터를 지정해주세요.`);
            }

            if (!erosionRequesters[serverId]) {
                erosionRequesters[serverId] = {};
            }
            erosionRequesters[serverId][userId] = activeCharacterName;

            message.channel.send(`1d10 등장침식 <@${message.author.id}>`);
        }

        // ==================== 콤보 명령어 ====================
        else if (message.content.startsWith('!콤보')) {
            console.log(`[콤보 디버깅] ====== 콤보 명령어 시작 ======`);
            console.log(`[콤보 디버깅] 원본 메시지: "${message.content}"`);
            console.log(`[콤보 디버깅] 메시지 길이: ${message.content.length}`);
            
            // 정규식 대신 수동 파싱으로 변경 (+ 기호 문제 해결)
            let content = message.content.substring(5).trim(); // "!콤보 " 제거
            console.log(`[콤보 디버깅] 처리할 내용: "${content}"`);
            
            if (!content) {
                return message.channel.send('❌ 사용법: `!콤보 ["콤보 이름"] [침식률조건] [콤보 데이터]`');
            }
            
            let comboName = '';
            let condition = '';
            let comboDescription = '';
            
            try {
                // 1단계: 콤보 이름 추출
                if (content.startsWith('"')) {
                    const endQuote = content.indexOf('"', 1);
                    if (endQuote === -1) {
                        return message.channel.send('❌ 콤보 이름의 따옴표가 닫히지 않았습니다.');
                    }
                    comboName = content.substring(1, endQuote);
                    content = content.substring(endQuote + 1).trim();
                } else if (content.startsWith('[')) {
                    const endBracket = content.indexOf(']', 1);
                    if (endBracket === -1) {
                        return message.channel.send('❌ 콤보 이름의 대괄호가 닫히지 않았습니다.');
                    }
                    comboName = content.substring(1, endBracket);
                    content = content.substring(endBracket + 1).trim();
                } else {
                    const spaceIndex = content.indexOf(' ');
                    if (spaceIndex === -1) {
                        return message.channel.send('❌ 침식률 조건과 콤보 데이터가 필요합니다.');
                    }
                    comboName = content.substring(0, spaceIndex);
                    content = content.substring(spaceIndex + 1).trim();
                }
                
                console.log(`[콤보 디버깅] 추출된 콤보명: "${comboName}"`);
                console.log(`[콤보 디버깅] 남은 내용: "${content}"`);
                
                // 2단계: 침식률 조건 추출 (100↑ 또는 99↓ 형태)
                const parts = content.split(' ');
                let conditionFound = false;
                
                for (let i = 0; i < parts.length; i++) {
                    if (parts[i].match(/^\d+[↑↓]$/)) {
                        condition = parts[i];
                        // 조건 이후의 모든 부분을 콤보 설명으로 사용
                        comboDescription = parts.slice(i + 1).join(' ');
                        conditionFound = true;
                        break;
                    }
                }
                
                if (!conditionFound) {
                    return message.channel.send('❌ 침식률 조건을 찾을 수 없습니다. 형식: `99↓`, `100↑` 등');
                }
                
                if (!comboDescription.trim()) {
                    return message.channel.send('❌ 콤보 데이터가 없습니다.');
                }
                
                console.log(`[콤보 디버깅] 추출된 데이터:`);
                console.log(`[콤보 디버깅] - 콤보명: "${comboName}"`);
                console.log(`[콤보 디버깅] - 조건: "${condition}"`);
                console.log(`[콤보 디버깅] - 설명: "${comboDescription}"`);
                
            } catch (error) {
                console.error(`[콤보 디버깅] ❌ 파싱 실패:`, error);
                return message.channel.send('❌ 콤보 데이터 파싱 중 오류가 발생했습니다.');
            }
            
            let activeCharacterName = activeCharacter[serverId]?.[userId];
            console.log(`[콤보 디버깅] 활성 캐릭터: "${activeCharacterName}"`);
            
            if (!activeCharacterName) {
                console.log(`[콤보 디버깅] ❌ 활성 캐릭터 없음`);
                return message.reply(`${message.author.tag}님, 활성화된 캐릭터가 없습니다. \`!지정 ["캐릭터 이름"]\` 명령어로 캐릭터를 지정해주세요.`);
            }
            
            console.log(`[콤보 디버깅] 데이터 구조 초기화 시작...`);
            
            // 서버별, 사용자별, 캐릭터별 데이터 저장 구조 생성
            if (!comboData[serverId]) {
                comboData[serverId] = {};
                console.log(`[콤보 디버깅] 서버 데이터 초기화 완료`);
            }
            if (!comboData[serverId][userId]) {
                comboData[serverId][userId] = {};
                console.log(`[콤보 디버깅] 사용자 데이터 초기화 완료`);
            }
            if (!comboData[serverId][userId][activeCharacterName]) {
                comboData[serverId][userId][activeCharacterName] = {};
                console.log(`[콤보 디버깅] 캐릭터 데이터 초기화 완료`);
            }
            if (!comboData[serverId][userId][activeCharacterName][comboName]) {
                comboData[serverId][userId][activeCharacterName][comboName] = {};
                console.log(`[콤보 디버깅] 콤보 데이터 초기화 완료`);
            }
            
            console.log(`[콤보 디버깅] 콤보 저장 시작...`);
            
            // 콤보 데이터 저장
            comboData[serverId][userId][activeCharacterName][comboName][condition] = comboDescription;
            
            console.log(`[콤보 디버깅] 콤보 데이터 저장 완료`);
            console.log(`[콤보 디버깅] 저장된 데이터:`, comboData[serverId][userId][activeCharacterName][comboName]);
            
            try {
                saveComboData(comboData);  // comboData 인자 전달
                console.log(`[콤보 디버깅] 파일 저장 완료`);
            } catch (error) {
                console.error(`[콤보 디버깅] ❌ 파일 저장 실패:`, error);
                return message.channel.send(`❌ 콤보 저장 중 파일 쓰기 오류가 발생했습니다: ${error.message}`);
            }
            
            console.log(`[콤보 디버깅] ====== 콤보 명령어 완료 ======`);
            
            return message.channel.send(`✅ **${activeCharacterName}**의 콤보 **"${comboName}"** (${condition})가 저장되었습니다.\n🔍 **저장된 내용:** ${comboDescription.substring(0, 100)}${comboDescription.length > 100 ? '...' : ''}`);
        }

        // ==================== 콤보 호출 명령어 ====================
        else if (message.content.startsWith('!@')) {
            let match = message.content.match(/^!@\s*(["'\[].*?["'\]]|\S+)/);
            if (!match) return;

            let comboName = extractComboName(match[1]);
            let activeCharacterName = activeCharacter[serverId]?.[userId];

            if (!activeCharacterName) {
                return message.reply(`${message.author.tag}님, 활성화된 캐릭터가 없습니다. \`!지정 ["캐릭터 이름"]\` 명령어로 캐릭터를 지정해주세요.`);
            }

            if (!comboData[serverId] || !comboData[serverId][userId] || !comboData[serverId][userId][activeCharacterName] || !comboData[serverId][userId][activeCharacterName][comboName]) {
                return message.channel.send(`❌ **${activeCharacterName}**의 콤보 '${comboName}'를 찾을 수 없습니다.`);
            }

            let currentErosion = data[serverId]?.[userId]?.[activeCharacterName]?.['침식률'] || 0;
            let availableCombos = comboData[serverId][userId][activeCharacterName][comboName];

            let selectedCombo = null;
            let selectedCondition = null;
            for (let condition in availableCombos) {
                if (condition.includes('↑')) {
                    let threshold = parseInt(condition.replace('↑', ''));
                    if (currentErosion >= threshold) {
                        selectedCombo = availableCombos[condition];
                        selectedCondition = condition;
                    }
                } else if (condition.includes('↓')) {
                    let threshold = parseInt(condition.replace('↓', ''));
                    if (currentErosion <= threshold) {
                        selectedCombo = availableCombos[condition];
                        selectedCondition = condition;
                    }
                }
            }

            if (selectedCombo) {
                // | 기호를 기준으로 줄바꿈 처리
                const formattedCombo = selectedCombo.replace(/\s*\|\s*/g, '\n> ');
                return message.channel.send(`> **${selectedCondition} 【${comboName}】**\n> ${formattedCombo}`);
            } else {
                return message.channel.send(`❌ 침식률 조건에 맞는 '${comboName}' 콤보를 찾을 수 없습니다.`);
            }
        }

        // ==================== 콤보 삭제 명령어 ====================
        else if (message.content.startsWith('!콤보삭제 ')) {
            const regex = /^!콤보삭제\s+(?:"([^"]+)"|\[([^\]]+)\]|(\S+))$/;
            const match = message.content.match(regex);

            if (!match) {
                return message.channel.send('❌ 사용법: `!콤보삭제 "콤보 이름"` 또는 `!콤보삭제 [콤보 이름]`');
            }

            let comboName = match[1] || match[2] || match[3];
            let activeCharacterName = activeCharacter[serverId]?.[userId];

            if (!activeCharacterName) {
                return message.reply(`${message.author.tag}님, 활성화된 캐릭터가 없습니다. \`!지정 ["캐릭터 이름"]\` 명령어로 캐릭터를 지정해주세요.`);
            }

            if (!comboData[serverId] || !comboData[serverId][userId] || !comboData[serverId][userId][activeCharacterName] || !comboData[serverId][userId][activeCharacterName][comboName]) {
                return message.channel.send(`❌ **${activeCharacterName}**에게 **"${comboName}"** 콤보가 존재하지 않습니다.`);
            }

            // 콤보 삭제
            delete comboData[serverId][userId][activeCharacterName][comboName];
            saveComboData(comboData);  // comboData 인자 전달

            return message.channel.send(`🗑️ **${activeCharacterName}**의 콤보 **"${comboName}"**가 삭제되었습니다.`);
        }

        // ==================== 캐릭터 삭제 명령어 ====================
        else if (message.content.startsWith('!캐릭터삭제')) {
            const regex = /^!캐릭터삭제\s+(?:"([^"]+)"|\[([^\]]+)\]|(\S+))$/;
            const match = message.content.match(regex);

            if (!match) {
                return message.channel.send('❌ 사용법: `!캐릭터삭제 "캐릭터 이름"` 또는 `!캐릭터삭제 [캐릭터 이름]`');
            }

            const characterName = match[1] || match[2] || match[3];

            if (!data[serverId] || !data[serverId][userId] || !data[serverId][userId][characterName]) {
                return message.channel.send(`❌ **"${characterName}"** 캐릭터를 찾을 수 없습니다.`);
            }

            delete data[serverId][userId][characterName];

            if (comboData[serverId] && comboData[serverId][userId] && comboData[serverId][userId][characterName]) {
                delete comboData[serverId][userId][characterName];
                saveComboData(comboData);
            }

            if (activeCharacter[serverId] && activeCharacter[serverId][userId] === characterName) {
                delete activeCharacter[serverId][userId];
            }

            saveData(data);
            return message.channel.send(`✅ **"${characterName}"** 캐릭터가 삭제되었습니다.`);
        }

        // ==================== 로이스 명령어 ====================
        else if (message.content.startsWith('!로이스 ')) {
            const regex = /^!로이스\s+(?:"([^"]+)"|\[([^\]]+)\]|(\S+))\s+(\S+)\s+(\S+)\s+(.+)$/;
            const match = message.content.match(regex);

            if (!match) {
                return message.channel.send('❌ 사용법: `!로이스 ["로이스 이름"] P감정 N감정 내용`\n📌 P감정에 `*`을 붙이면 메인 감정으로 설정됩니다.');
            }

            let loisName = match[1] || match[2] || match[3];
            let pEmotion = match[4];
            let nEmotion = match[5];
            let loisDescription = match[6];

            let formattedPEmotion = pEmotion.includes('*') ? `【P: ${pEmotion.replace('*', '')}】` : `P: ${pEmotion}`;
            let formattedNEmotion = nEmotion.includes('*') ? `【N: ${nEmotion.replace('*', '')}】` : `N: ${nEmotion}`;

            let activeCharacterName = activeCharacter[serverId] && activeCharacter[serverId][userId];

            if (!activeCharacterName) {
                return message.reply(`${message.author.tag}님, 활성화된 캐릭터가 없습니다. \`!지정 ["캐릭터 이름"]\` 명령어로 캐릭터를 지정해주세요.`);
            }

            if (!data[serverId]) data[serverId] = {};
            if (!data[serverId][userId]) data[serverId][userId] = {};
            if (!data[serverId][userId][activeCharacterName]) data[serverId][userId][activeCharacterName] = {};
            if (!data[serverId][userId][activeCharacterName].lois) data[serverId][userId][activeCharacterName].lois = [];

            let loisList = data[serverId][userId][activeCharacterName].lois;

            let existingIndex = loisList.findIndex(lois => lois.name === loisName);
            if (existingIndex !== -1) {
                loisList[existingIndex] = {
                    name: loisName,
                    pEmotion: formattedPEmotion,
                    nEmotion: formattedNEmotion,
                    description: loisDescription
                };
            } else {
                loisList.push({
                    name: loisName,
                    pEmotion: formattedPEmotion,
                    nEmotion: formattedNEmotion,
                    description: loisDescription
                });
            }

            saveData(data);
            return message.channel.send(`✅ **${activeCharacterName}**의 로이스 **"${loisName}"**가 등록되었습니다.\n${formattedPEmotion} / ${formattedNEmotion}\n${loisDescription}`);
        }

        // ==================== 로이스 삭제 명령어 ====================
        else if (message.content.startsWith('!로이스삭제 ')) {
            const args = message.content.split(' ').slice(1);

            if (args.length < 1) {
                return message.channel.send('❌ 사용법: `!로이스삭제 ["로이스 이름"]`');
            }

            let loisName = extractLoisName(args.join(' '));
            let activeCharacterName = activeCharacter[serverId]?.[userId];

            if (!activeCharacterName) {
                return message.reply(`❌ 활성화된 캐릭터가 없습니다. \`!지정 ["캐릭터 이름"]\` 명령어로 캐릭터를 지정해주세요.`);
            }

            if (!data[serverId] || !data[serverId][userId] || !data[serverId][userId][activeCharacterName]?.lois) {
                return message.channel.send(`❌ **${activeCharacterName}**에게 등록된 로이스가 없습니다.`);
            }

            let loisList = data[serverId][userId][activeCharacterName].lois;
            let index = loisList.findIndex(lois => lois.name === loisName);

            if (index === -1) {
                return message.channel.send(`❌ **${activeCharacterName}**에게 **"${loisName}"** 로이스가 존재하지 않습니다.`);
            }

            loisList.splice(index, 1);
            saveData(data);

            return message.channel.send(`🗑️ **${activeCharacterName}**의 로이스 **"${loisName}"**가 삭제되었습니다.`);
        }

        // ==================== 타이터스 명령어 ====================
        else if (message.content.startsWith('!타이터스 ')) {
            const args = message.content.split(' ').slice(1);

            if (args.length < 1) {
                return message.channel.send('❌ 사용법: `!타이터스 ["로이스 이름"]`');
            }

            let loisName = extractLoisName(args.join(' '));
            let activeCharacterName = activeCharacter[serverId]?.[userId];

            if (!activeCharacterName) {
                return message.reply(`❌ 활성화된 캐릭터가 없습니다. \`!지정 ["캐릭터 이름"]\` 명령어로 캐릭터를 지정해주세요.`);
            }

            if (!data[serverId] || !data[serverId][userId] || !data[serverId][userId][activeCharacterName]?.lois) {
                return message.channel.send(`❌ **${activeCharacterName}**에게 등록된 로이스가 없습니다.`);
            }

            let loisList = data[serverId][userId][activeCharacterName].lois;
            let index = loisList.findIndex(lois => lois.name === loisName);

            if (index === -1) {
                return message.channel.send(`❌ **${activeCharacterName}**에게 **"${loisName}"** 로이스가 존재하지 않습니다.`);
            }

            // 침식률 상승 (타이터스로 변환할 때 +5 적용)
            data[serverId][userId][activeCharacterName]['침식률'] = 
                (data[serverId][userId][activeCharacterName]['침식률'] || 0) + 5;

            loisList.splice(index, 1);
            saveData(data);

            return message.channel.send(`🔥 **${activeCharacterName}**의 로이스 **"${loisName}"**가 타이터스로 변환되었습니다!`);
        }

    } catch (error) {
        console.error("🚨 [명령어 처리 중 오류 발생]:", error);

        if (error.code === 50013) {
            console.error(`❌ 서버 "${message.guild.name}"에서 메시지를 보낼 수 있는 권한이 없음.`);
            
            try {
                const owner = await message.guild.fetchOwner();
                if (owner) {
                    owner.send(
                        `❌ **DX3bot이 "${message.guild.name}" 서버에서 메시지를 보낼 수 없습니다.**\n봇의 권한을 확인해주세요!`
                    );
                }
            } catch (dmError) {
                console.error("🚫 서버 소유자에게 DM을 보낼 수 없습니다:", dmError);
            }
        }

        // 관리자에게 DM으로 오류 메시지 보내기
        try {
            const owner = await client.users.fetch(BOT_OWNER_ID);
            if (owner) {
                owner.send(`🚨 **DX3bot 명령어 처리 중 오류 발생!**\n\`\`\`${error.stack || error.message}\`\`\``)
                    .then(() => console.log("📩 봇 관리자에게 오류 메시지를 보냈습니다."))
                    .catch(err => console.error("❌ 봇 관리자에게 오류 DM 전송 실패:", err));
            }
        } catch (fetchError) {
            console.error("❌ 봇 관리자 정보를 가져오는 중 오류 발생:", fetchError);
        }
    }
});

// ==================== 주사위 봇 결과 처리 ====================

client.on('messageCreate', async (diceMessage) => {
    if (!diceMessage.author.bot) return;

    const diceResultMatch = diceMessage.content.match(/(?:\(\d+D\d+\)|＞.*?)\s*＞\s*(\d+)/);
    if (!diceResultMatch) return;

    let diceResult = parseInt(diceResultMatch[1]);
    const serverId = diceMessage.guild?.id;
    if (!serverId || !erosionRequesters[serverId]) return;

    let userId = Object.keys(erosionRequesters[serverId])[0];
    if (!userId) return;

    let activeCharacterName = erosionRequesters[serverId][userId];
    delete erosionRequesters[serverId][userId];

    const data = loadData();
    if (!data[serverId] || !data[serverId][userId] || !data[serverId][userId][activeCharacterName]) return;

    let currentStatus = data[serverId][userId][activeCharacterName];
    let newErosion = (currentStatus['침식률'] || 0) + diceResult;
    currentStatus['침식률'] = newErosion;

    const messages = updateErosionD(currentStatus, newErosion);
    for (const msg of messages) {
        diceMessage.channel.send(msg);
    }

    saveData(data);

    diceMessage.channel.send(
        `${activeCharacterName} 등장침식 +${diceResult} → 현재 침식률: ${newErosion}\n <@${userId}>`
    );
});

// ==================== 정기 작업 및 오류 처리 ====================

// 12시간마다 BCdicebot 깨우기
const targetBotTag = "BCdicebot#8116";
const diceCommand = "bcdice set DoubleCross:Korean";
const interval = 12 * 60 * 60 * 1000;

setInterval(() => {
    client.guilds.cache.forEach(guild => {
        const targetBot = guild.members.cache.find(member => member.user.tag === targetBotTag);
        if (targetBot) {
            const textChannel = guild.channels.cache.find(channel => 
                channel.type === 0 && channel.permissionsFor(client.user).has("SEND_MESSAGES")
            );
            if (textChannel) {
                textChannel.send(diceCommand)
                    .then(() => console.log(`✅ BCdicebot을 깨웠습니다: ${guild.name}`))
                    .catch(err => console.error(`❌ BCdicebot 메시지 전송 실패 (${guild.name}):`, err));
            }
        }
    });
}, interval);

// 오류 발생 시 처리
client.on('error', async (error) => {
    console.error("🚨 [봇 오류 발생]:", error);

    try {
        const owner = await client.users.fetch(BOT_OWNER_ID);
        if (owner) {
            owner.send(`🚨 **DX3bot 오류 발생!**\n\`\`\`${error.stack || error.message}\`\`\``)
                .then(() => console.log("📩 봇 관리자에게 오류 메시지를 보냈습니다."))
                .catch(err => console.error("❌ 봇 관리자에게 오류 DM 전송 실패:", err));
        }
    } catch (fetchError) {
        console.error("❌ 봇 관리자 정보를 가져오는 중 오류 발생:", fetchError);
    }
});

// ==================== 봇 로그인 ====================

client.login(token);
console.log("✅ 디스코드 봇이 로그인되었습니다!");
