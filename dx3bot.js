// 필요한 모듈 가져오기
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Events, EmbedBuilder } = require('discord.js');

// 파일 경로 설정
const versionFilePath = path.join(__dirname, 'version.json');
const dataFilePath = path.join(__dirname, 'data.json');
const activeCharacterFile = path.join(__dirname, 'active_character.json');
const comboDataFile = path.join(__dirname, 'comboData.json');

// 환경 변수 로드
require('dotenv').config();

// 디스코드 클라이언트 설정
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// 환경 변수 검증
const token = process.env.DISCORD_BOT_TOKEN;
const BOT_OWNER_ID = process.env.BOT_OWNER_ID;

if (!token) {
    console.error("❌ DISCORD_BOT_TOKEN 환경 변수가 설정되지 않았습니다!");
    process.exit(1);
}

// 상수 정의
const SYNDROME_TRANSLATION = {
    "엔젤 헤일로": "ANGEL HALO",
    "발로르": "BALOR",
    "블랙독": "BLACK DOG",
    "브람스토커": "BRAM STOKER",
    "키마이라": "CHIMAERA",
    "엑자일": "EXILE",
    "하누만": "HANUMAN",
    "모르페우스": "MORPHEUS",
    "노이만": "NEUMANN",
    "오르쿠스": "ORCUS",
    "샐러맨더": "SALAMANDRA",
    "솔라리스": "SOLARIS",
    "우로보로스": "OUROBOROS",
    "아자토스": "AZATHOTH",
    "미스틸테인": "MISTILTEN",
    "글레이프닐": "GLEIPNIR"
};

const MAIN_ATTRIBUTES = ['육체', '감각', '정신', '사회'];

const SUB_TO_MAIN_MAPPING = {
    '백병': '육체',
    '회피': '육체',
    '사격': '감각',
    '지각': '감각',
    'RC': '정신',
    '의지': '정신',
    '교섭': '사회',
    '조달': '사회',
};

const DYNAMIC_MAPPING_RULES = {
    '운전:': '육체',
    '정보:': '사회',
    '예술:': '감각',
    '지식:': '정신',
};

const EROSION_THRESHOLDS = [
    { erosion: 60, d: 1 },
    { erosion: 80, d: 2 },
    { erosion: 100, d: 3 },
    { erosion: 130, d: 4 },
    { erosion: 190, d: 5 }
];

// 유틸리티 함수들
const utils = {
    // 데이터 로드 함수
    loadData: () => {
        if (!fs.existsSync(dataFilePath)) {
            fs.writeFileSync(dataFilePath, JSON.stringify({}));
        }
        try {
            return JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
        } catch (error) {
            console.error('데이터 로딩 오류:', error);
            return {};
        }
    },

    // 데이터 저장 함수
    saveData: (data) => {
        try {
            fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('데이터 저장 오류:', error);
        }
    },

    // 버전 데이터 로드
    loadVersion: () => {
        if (!fs.existsSync(versionFilePath)) {
            return { major: 1, minor: 0, patch: 0 };
        }
        try {
            return JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));
        } catch (error) {
            console.error('버전 로딩 오류:', error);
            return { major: 1, minor: 0, patch: 0 };
        }
    },

    // 버전 데이터 저장
    saveVersion: (versionData) => {
        try {
            fs.writeFileSync(versionFilePath, JSON.stringify(versionData, null, 2));
        } catch (error) {
            console.error('버전 저장 오류:', error);
        }
    },

    // 활성 캐릭터 데이터 로드
    loadActiveCharacter: () => {
        if (!fs.existsSync(activeCharacterFile)) {
            return {};
        }
        try {
            return JSON.parse(fs.readFileSync(activeCharacterFile, 'utf8'));
        } catch (error) {
            console.error('활성 캐릭터 로딩 오류:', error);
            return {};
        }
    },

    // 활성 캐릭터 데이터 저장
    saveActiveCharacter: (data) => {
        try {
            fs.writeFileSync(activeCharacterFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('활성 캐릭터 저장 오류:', error);
        }
    },

    // 콤보 데이터 로드
    loadComboData: () => {
        if (!fs.existsSync(comboDataFile)) {
            return {};
        }
        try {
            return JSON.parse(fs.readFileSync(comboDataFile, 'utf8'));
        } catch (error) {
            console.error('콤보 데이터 로딩 오류:', error);
            return {};
        }
    },

    // 콤보 데이터 저장
    saveComboData: (data) => {
        try {
            fs.writeFileSync(comboDataFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('콤보 데이터 저장 오류:', error);
        }
    },

    // 텍스트에서 이름 추출 (따옴표나 대괄호 처리)
    extractName: (input) => {
        const match = input.match(/^["'\[](.*?)["'\]]$/);
        return match ? match[1] : input;
    },

    // 안전한 정수 변환
    safeParseInt: (value, defaultValue = 0) => {
        const parsed = parseInt(value);
        return isNaN(parsed) ? defaultValue : parsed;
    }
};

// 전역 변수들
let data = utils.loadData();
let currentVersion = utils.loadVersion();
let activeCharacter = utils.loadActiveCharacter();
let comboData = utils.loadComboData();
let erosionRequesters = {}; // 등장침식 요청자 추적

// 신드롬 변환 함수
const convertSyndromeToEnglish = (syndrome) => {
    return (SYNDROME_TRANSLATION[syndrome] || syndrome).toUpperCase();
};

// 명령어 핸들러 클래스
class CommandHandler {
    constructor() {
        this.commands = new Map();
        this.setupCommands();
    }

    setupCommands() {
        // 기본 명령어들
        this.commands.set('도움', this.handleHelp.bind(this));
        this.commands.set('시트입력', this.handleSheetInput.bind(this));
        this.commands.set('지정', this.handleSetActive.bind(this));
        this.commands.set('지정해제', this.handleUnsetActive.bind(this));
        this.commands.set('시트확인', this.handleSheetCheck.bind(this));
        this.commands.set('판정', this.handleRoll.bind(this));
        this.commands.set('등침', this.handleEntryErosion.bind(this));
        this.commands.set('등장침식', this.handleEntryErosion.bind(this));
        this.commands.set('콤보', this.handleCombo.bind(this));
        this.commands.set('로이스', this.handleLois.bind(this));
        this.commands.set('로이스삭제', this.handleDeleteLois.bind(this));
        this.commands.set('타이터스', this.handleTitus.bind(this));
        this.commands.set('리셋', this.handleReset.bind(this));
        this.commands.set('캐릭터삭제', this.handleDeleteCharacter.bind(this));
        this.commands.set('업데이트', this.handleUpdate.bind(this));
        
        // 캐릭터 속성 설정 명령어들
        this.commands.set('코드네임', this.handleCodeName.bind(this));
        this.commands.set('이모지', this.handleEmoji.bind(this));
        this.commands.set('커버', this.handleCover.bind(this));
        this.commands.set('웍스', this.handleWorks.bind(this));
        this.commands.set('브리드', this.handleBreed.bind(this));
        this.commands.set('신드롬', this.handleSyndrome.bind(this));
        this.commands.set('각성', this.handleAwakening.bind(this));
        this.commands.set('충동', this.handleImpulse.bind(this));
        this.commands.set('D로', this.handleDLois.bind(this));
    }

    async handle(message) {
        try {
            const content = message.content.trim();
            
            // 특수 명령어 처리
            if (content.startsWith('!@')) {
                return await this.handleComboCall(message);
            }
            
            // 상태 변경 명령어 처리 (!HP+10, !침식률-5 등)
            if (this.isStatCommand(content)) {
                return await this.handleStatChange(message);
            }

            // 일반 명령어 처리
            if (!content.startsWith('!')) return;

            const args = content.slice(1).split(' ');
            const command = args[0];

            if (this.commands.has(command)) {
                await this.commands.get(command)(message, args.slice(1));
            }
        } catch (error) {
            console.error('명령어 처리 오류:', error);
            await this.handleError(message, error);
        }
    }

    isStatCommand(content) {
        return content.startsWith('!') && 
               (content.includes('+') || content.includes('-') || content.includes('='));
    }

    // 활성 캐릭터 정보 가져오기
    getActiveCharacter(message) {
        if (!message.guild) return null;
        
        const serverId = message.guild.id;
        const userId = message.author.id;
        
        const activeCharName = activeCharacter[serverId]?.[userId];
        if (!activeCharName || !data[serverId]?.[userId]?.[activeCharName]) {
            return null;
        }
        
        return {
            name: activeCharName,
            data: data[serverId][userId][activeCharName],
            serverId,
            userId
        };
    }

    // 도움말 명령어
    async handleHelp(message) {
        const embed1 = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('📖 DX3bot 명령어 목록 (1/3)')
            .setDescription('DX3bot의 주요 기능을 안내합니다.')
            .addFields(
                {
                    name: '📌 **캐릭터 관리**',
                    value: '> `!시트입력` `"캐릭터 이름"` 항목1 값1 항목2 값2 ...\n' +
                           '> 새로운 캐릭터를 등록하거나 기존 캐릭터 정보를 수정합니다.\n' +
                           '> **예시:** `!시트입력 "캐릭터 이름" 육체 3 감각 6`\n' +
                           '> `!지정` `"캐릭터 이름"` - 특정 캐릭터를 활성화합니다.\n' +
                           '> `!지정해제` - 현재 활성화된 캐릭터를 해제합니다.\n' +
                           '> `!시트확인` - 현재 활성 캐릭터의 정보를 확인합니다.'
                },
                {
                    name: '📌 **상태 변경**',
                    value: '> `!침식률+N`, `!HP-10`\n' +
                           '> 특정 능력치 값을 증가/감소/설정합니다.\n' +
                           '> **예시:** `!침식률+5`'
                },
                {
                    name: '🎲 **판정 시스템**',
                    value: '> `!판정` `[항목]` - 해당 능력으로 주사위를 굴립니다.\n' +
                           '> 침식D가 자동 적용됩니다.\n' +
                           '> **예시:** `!판정 백병`'
                },
                {
                    name: '⚔ **등장 침식**',
                    value: '> `!등침`, `!등장침식` - 등장 시 `1d10`을 굴려 침식률을 추가합니다.'
                }
            );

        const embed2 = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('📖 DX3bot 명령어 목록 (2/3)')
            .addFields(
                {
                    name: '🎭 **캐릭터 상세 설정**',
                    value: '> `!이모지` `[이모지]` - 캐릭터의 이모지를 설정합니다.\n' +
                           '> `!커버` `[이름]` - 캐릭터의 커버를 설정합니다.\n' +
                           '> `!웍스` `[이름]` - 캐릭터의 웍스를 설정합니다.\n' +
                           '> `!브리드` `[퓨어/크로스/트라이]` - 브리드를 설정합니다.\n' +
                           '> `!신드롬` `[신드롬1]` `[신드롬2]` `[신드롬3]` - 신드롬을 설정합니다.\n' +
                           '> `!각성` `[이름]` - 캐릭터의 각성을 설정합니다.\n' +
                           '> `!충동` `[이름]` - 캐릭터의 충동을 설정합니다.\n' +
                           '> `!D로` `[번호]` `[이름]` - D-Lois를 설정합니다.\n' +
                           '> **예시:** `!D로 98 Legacy: Dream of Abyssal City`'
                },
                {
                    name: '⚔ **콤보 시스템**',
                    value: '> `!콤보` `"콤보 이름"` `[침식률 조건]` `[콤보 데이터]`\n' +
                           '> 특정 침식률에 따라 콤보를 저장합니다.\n' +
                           '> **침식률 조건 작성법:**\n' +
                           '> - `99↓` : 침식률이 **99 이하**일 때 적용\n' +
                           '> - `100↑` : 침식률이 **100 이상**일 때 적용\n' +
                           '> - `130↑` : 침식률이 **130 이상**일 때 적용\n' +
                           '> **예시:** `!콤보 "연속 사격" 99↓ 《C: 발로르(2) + 흑의 철퇴(4)》`\n' +
                           '> `!@"콤보 이름"` - 침식률에 맞는 콤보를 자동 검색 후 출력'
                }
            );

        const embed3 = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('📖 DX3bot 명령어 목록 (3/3)')
            .addFields(
                {
                    name: '🔹 **로이스 시스템**',
                    value: '> `!로이스` `"이름"` `[P감정]` `[N감정]` `[내용]` - 새로운 로이스를 추가합니다.\n' +
                           '> **P 감정을 강조하려면 감정 뒤에 `*`을 추가하세요.**\n' +
                           '> **예시:** `!로이스 "배신자" 증오* 분노 나를 배신한 동료`\n' +
                           '> **출력 예시:**\n' +
                           '> > **배신자** | 【P: 증오】 / N: 분노 | 나를 배신한 동료\n' +
                           '> `!로이스삭제` `"이름"` - 해당 로이스 삭제\n' +
                           '> `!타이터스` `"이름"` - 해당 로이스를 타이터스로 변환'
                },
                {
                    name: '🔧 **관리 명령어**',
                    value: '> `!리셋` - 현재 캐릭터의 모든 데이터를 초기화합니다.\n' +
                           '> `!리셋 콤보` - 콤보 데이터만 초기화\n' +
                           '> `!리셋 로이스` - 로이스 데이터만 초기화\n' +
                           '> `!캐릭터삭제` `"이름"` - 특정 캐릭터 데이터를 삭제'
                }
            )
            .setFooter({ text: '📌 이상이 있다면 언제든 오샤(@TRPG_sha)로 DM 해주세요!' });

        await message.channel.send({ embeds: [embed1] });
        await message.channel.send({ embeds: [embed2] });
        await message.channel.send({ embeds: [embed3] });
    }

    // 시트 입력 명령어
    async handleSheetInput(message, args) {
        if (!message.guild) return;
        
        const serverId = message.guild.id;
        const userId = message.author.id;
        
        const regex = /^(?:"([^"]+)"|\[([^\]]+)\]|(\S+))\s+(.+)$/;
        const match = args.join(' ').match(regex);
        
        if (!match) {
            return message.channel.send('❌ 사용법: `!시트입력 "캐릭터 이름" [항목1] [값1] [항목2] [값2] ...`');
        }

        const characterName = match[1] || match[2] || match[3];
        const attributeArgs = match[4].split(/\s+/);
        
        if (attributeArgs.length < 2 || attributeArgs.length % 2 !== 0) {
            return message.channel.send('❌ 속성은 최소한 하나 이상 입력해야 하며, 속성과 값은 짝수여야 합니다.');
        }

        // 서버 데이터 구조 초기화
        if (!data[serverId]) data[serverId] = {};
        if (!data[serverId][userId]) data[serverId][userId] = {};
        if (!data[serverId][userId][characterName]) data[serverId][userId][characterName] = {};

        // 속성 저장
        for (let i = 0; i < attributeArgs.length; i += 2) {
            const attribute = attributeArgs[i];
            const value = utils.safeParseInt(attributeArgs[i + 1]);
            
            if (isNaN(parseInt(attributeArgs[i + 1]))) {
                return message.channel.send(`❌ **${attributeArgs[i + 1]}**는 숫자가 아닙니다. 숫자 값만 입력해주세요.`);
            }

            data[serverId][userId][characterName][attribute] = value;
        }

        utils.saveData(data);
        message.channel.send(`✅ **${characterName}**의 항목이 설정되었습니다.`);
    }

    // 캐릭터 지정 명령어
    async handleSetActive(message, args) {
        if (!message.guild) return;
        
        const serverId = message.guild.id;
        const userId = message.author.id;
        
        if (args.length === 0) {
            return message.channel.send('❌ 사용법: `!지정 "캐릭터 이름"`');
        }

        const characterName = utils.extractName(args.join(' '));

        if (!data[serverId]?.[userId]?.[characterName]) {
            return message.channel.send(`❌ 캐릭터 "${characterName}"의 데이터를 찾을 수 없습니다. 먼저 \`!시트입력\`을 사용하여 캐릭터를 등록하세요.`);
        }

        if (!activeCharacter[serverId]) activeCharacter[serverId] = {};
        activeCharacter[serverId][userId] = characterName;

        utils.saveActiveCharacter(activeCharacter);
        message.channel.send(`✅ **${characterName}**님을 활성 캐릭터로 지정했습니다.`);
    }

    // 캐릭터 지정 해제 명령어
    async handleUnsetActive(message) {
        if (!message.guild) return;
        
        const serverId = message.guild.id;
        const userId = message.author.id;

        if (!activeCharacter[serverId]?.[userId]) {
            return message.reply("❌ 현재 활성화된 캐릭터가 없습니다.");
        }

        const prevCharacter = activeCharacter[serverId][userId];
        delete activeCharacter[serverId][userId];

        utils.saveActiveCharacter(activeCharacter);
        message.channel.send(`✅ **${prevCharacter}**님을 활성 캐릭터에서 해제했습니다.`);
    }

    // 시트 확인 명령어
    async handleSheetCheck(message) {
        const activeChar = this.getActiveCharacter(message);
        if (!activeChar) {
            return message.reply(`❌ 활성화된 캐릭터가 없습니다. \`!지정 [캐릭터 이름]\` 명령어로 캐릭터를 지정해주세요.`);
        }

        const characterData = activeChar.data;
        const characterCodeName = characterData.codeName || '코드네임 없음';
        const characterEmoji = characterData.emoji || '❌';

        // 로이스가 배열인지 확인 후 변환
        if (!Array.isArray(characterData.lois)) {
            characterData.lois = [];
        }

        // 브리드 값에 따라 타입 결정
        let breedType = "브리드 없음";
        if (characterData.breed) {
            const breed = characterData.breed.toLowerCase();
            if (breed === "퓨어") breedType = "PURE";
            else if (breed === "크로스") breedType = "CROSS";
            else if (breed === "트라이") breedType = "TRI";
        }

        // 저장된 신드롬 변환
        let syndromeList = characterData.syndromes ? characterData.syndromes.split(" × ") : ["신드롬 없음"];
        syndromeList = syndromeList.map(convertSyndromeToEnglish);

        // 상단 캐릭터 정보
        let response = `${characterEmoji}  **${activeChar.name}** :: **「${characterCodeName}」**\n`;
        response += `> ${characterData.cover || "커버 없음"}｜${characterData.works || "웍스 없음"}\n`;
        response += `> ${breedType}｜${syndromeList.join(" × ")}\n`;
        response += `> ${characterData.awakening || "각성 없음"}｜${characterData.impulse || "충동 없음"}\n`;
        response += `> D-Lois｜No.${characterData.dloisNo || "00"} ${characterData.dloisName || "D로이스 없음"}\n\n`;

        response += `> **HP** ${characterData.HP || 0}  |  **침식률** ${characterData.침식률 || 0}  |  **침식D** ${characterData.침식D || 0}  |  **로이스** ${characterData.lois.length}\n`;

        // 각 상위 항목에 대해 하위 항목을 찾고 출력
        for (let mainAttr of MAIN_ATTRIBUTES) {
            let subAttributes = [];
            let mainAttrValue = characterData[mainAttr] || 0;

            for (let [key, value] of Object.entries(characterData)) {
                if (SUB_TO_MAIN_MAPPING[key] === mainAttr) {
                    subAttributes.push(`${key}: ${value}`);
                } else {
                    for (let prefix in DYNAMIC_MAPPING_RULES) {
                        if (key.startsWith(prefix) && DYNAMIC_MAPPING_RULES[prefix] === mainAttr) {
                            subAttributes.push(`${key}: ${value}`);
                        }
                    }
                }
            }

            if (subAttributes.length > 0 || mainAttrValue !== 0) {
                response += `>     **【${mainAttr}】**  ${mainAttrValue}   ` + subAttributes.join(' ') + '\n';
            }
        }

        // 콤보 출력
        const { serverId, userId } = activeChar;
        if (comboData[serverId]?.[userId]?.[activeChar.name]) {
            response += `\n${characterEmoji}  **콤보**\n`;
            for (let comboName in comboData[serverId][userId][activeChar.name]) {
                response += `> ㆍ **${comboName}**\n`;
            }
        }

        // 로이스 출력
        if (characterData.lois && characterData.lois.length > 0) {
            response += `\n${characterEmoji}  **로이스**\n`;
            for (let lois of characterData.lois) {
                response += `> ㆍ **${lois.name}** | ${lois.pEmotion} / ${lois.nEmotion} | ${lois.description}\n`;
            }
        }

        return message.reply(response);
    }

    // 판정 명령어
    async handleRoll(message, args) {
        if (args.length < 1) {
            return message.channel.send('❌ 사용법: `!판정 [항목]`');
        }

        const activeChar = this.getActiveCharacter(message);
        if (!activeChar) {
            return message.reply(`❌ 활성화된 캐릭터가 없습니다. \`!지정 [캐릭터 이름]\` 명령어로 캐릭터를 지정해주세요.`);
        }

        const attribute = args[0];
        const characterData = activeChar.data;

        // 동적 항목이 있는 경우, 상위 항목으로 매핑
        let mainAttr = attribute;
        for (let key in DYNAMIC_MAPPING_RULES) {
            if (attribute.startsWith(key)) {
                mainAttr = DYNAMIC_MAPPING_RULES[key];
                break;
            }
        }
        for (let key in SUB_TO_MAIN_MAPPING) {
            if (attribute.startsWith(key)) {
                mainAttr = SUB_TO_MAIN_MAPPING[key];
                break;
            }
        }

        const mainValue = characterData[mainAttr] || 0;
        const subValue = characterData[attribute] || 0;
        const erosionD = characterData.침식D || 0;

        const finalMainValue = `(${mainValue}+${erosionD})dx`;
        const finalResult = `${finalMainValue}+${subValue}`;
        
        message.channel.send(`${finalResult}  ${attribute} 판정 <@${message.author.id}>`);
    }

    // 등장침식 명령어
    async handleEntryErosion(message) {
        const activeChar = this.getActiveCharacter(message);
        if (!activeChar) {
            return message.reply(`❌ 활성화된 캐릭터가 없습니다. \`!지정 [캐릭터 이름]\` 명령어로 캐릭터를 지정해주세요.`);
        }

        const serverId = message.guild.id;
        const userId = message.author.id;

        // 서버별로 사용자 ID 저장하여 후속 주사위 결과와 연결
        if (!erosionRequesters[serverId]) {
            erosionRequesters[serverId] = {};
        }
        erosionRequesters[serverId][userId] = activeChar.name;

        message.channel.send(`1d10 등장침식 <@${message.author.id}>`);
    }

// 콤보 명령어 처리 (원본과 동일)
if (message.content.startsWith('!콤보')) {
    if (!message.guild) return; // DM 방지

    const serverId = message.guild.id;
    const userId = message.author.id;

    // 정규식으로 콤보명과 나머지 데이터 분리
    const regex = /^!콤보\s+(?:"([^"]+)"|\[([^\]]+)\]|(\S+))\s+(\S+)\s+(.+)$/;
    const match = message.content.match(regex);

    if (!match) {
        return message.channel.send('❌ 사용법: `!콤보 ["콤보 이름"] [침식률조건] [콤보 데이터]`');
    }

    // 따옴표 또는 대괄호가 있으면 제거하여 콤보 이름 추출
    let comboName = match[1] || match[2] || match[3];
    let condition = match[4];  // 침식률 조건 (예: 99↓ 또는 100↑)
    let comboDescription = match[5];  // 콤보 데이터

    let activeCharacterName = activeCharacter[serverId]?.[userId];
    if (!activeCharacterName) {
        return message.reply(`${message.author.tag}님, 활성화된 캐릭터가 없습니다. \`!지정 ["캐릭터 이름"]\` 명령어로 캐릭터를 지정해주세요.`);
    }

    // 서버별, 사용자별, 캐릭터별 데이터 저장 구조 생성
    if (!comboData[serverId]) comboData[serverId] = {};
    if (!comboData[serverId][userId]) comboData[serverId][userId] = {};
    if (!comboData[serverId][userId][activeCharacterName]) comboData[serverId][userId][activeCharacterName] = {};
    if (!comboData[serverId][userId][activeCharacterName][comboName]) comboData[serverId][userId][activeCharacterName][comboName] = {};

    // 콤보 데이터 저장
    comboData[serverId][userId][activeCharacterName][comboName][condition] = comboDescription;
    utils.saveComboData(comboData);

    return message.channel.send(`✅ **${activeCharacterName}**의 콤보 **"${comboName}"**가 저장되었습니다.`);
}

    // 콤보 호출 명령어 (!@콤보이름)
    async handleComboCall(message) {
        if (!message.guild) return;

        const serverId = message.guild.id;
        const userId = message.author.id;

        const match = message.content.match(/^!@\s*(["'\[].*?["'\]]|\S+)/);
        if (!match) return;

        const comboName = utils.extractName(match[1]);
        const activeChar = this.getActiveCharacter(message);

        if (!activeChar) {
            return message.reply(`❌ 활성화된 캐릭터가 없습니다. \`!지정 ["캐릭터 이름"]\` 명령어로 캐릭터를 지정해주세요.`);
        }

        if (!comboData[serverId]?.[userId]?.[activeChar.name]?.[comboName]) {
            return message.channel.send(`❌ **${activeChar.name}**의 콤보 '${comboName}'를 찾을 수 없습니다.`);
        }

        const currentErosion = activeChar.data['침식률'] || 0;
        const availableCombos = comboData[serverId][userId][activeChar.name][comboName];

        // 침식률 조건에 맞는 콤보 찾기
        let selectedCombo = null;
        let selectedCondition = null;
        for (let condition in availableCombos) {
            if (condition.includes('↑')) {
                const threshold = parseInt(condition.replace('↑', ''));
                if (currentErosion >= threshold) {
                    selectedCombo = availableCombos[condition];
                    selectedCondition = condition;
                }
            } else if (condition.includes('↓')) {
                const threshold = parseInt(condition.replace('↓', ''));
                if (currentErosion <= threshold) {
                    selectedCombo = availableCombos[condition];
                    selectedCondition = condition;
                }
            }
        }

        if (selectedCombo) {
            return message.channel.send(`> **${selectedCondition} 【${comboName}】**\n> ${selectedCombo}`);
        } else {
            return message.channel.send(`❌ 침식률 조건에 맞는 '${comboName}' 콤보를 찾을 수 없습니다.`);
        }
    }

    // 로이스 명령어
    async handleLois(message, args) {
        const regex = /^(?:"([^"]+)"|\[([^\]]+)\]|(\S+))\s+(\S+)\s+(\S+)\s+(.+)$/;
        const match = args.join(' ').match(regex);

        if (!match) {
            return message.channel.send('❌ 사용법: `!로이스 ["로이스 이름"] P감정 N감정 내용`\n📌 P감정에 `*`을 붙이면 메인 감정으로 설정됩니다.');
        }

        const loisName = match[1] || match[2] || match[3];
        const pEmotion = match[4];
        const nEmotion = match[5];
        const loisDescription = match[6];

        const activeChar = this.getActiveCharacter(message);
        if (!activeChar) {
            return message.reply(`❌ 활성화된 캐릭터가 없습니다. \`!지정 ["캐릭터 이름"]\` 명령어로 캐릭터를 지정해주세요.`);
        }

        // 메인 감정 강조: `*`이 붙은 감정만 【】로 감싸기
        const formattedPEmotion = pEmotion.includes('*') ? `【P: ${pEmotion.replace('*', '')}】` : `P: ${pEmotion}`;
        const formattedNEmotion = nEmotion.includes('*') ? `【N: ${nEmotion.replace('*', '')}】` : `N: ${nEmotion}`;

        if (!activeChar.data.lois) activeChar.data.lois = [];

        const loisList = activeChar.data.lois;

        // 중복 방지: 같은 이름의 로이스가 있으면 덮어쓰기
        const existingIndex = loisList.findIndex(lois => lois.name === loisName);
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

        utils.saveData(data);
        message.channel.send(`✅ **${activeChar.name}**의 로이스 **"${loisName}"**가 등록되었습니다.\n${formattedPEmotion} / ${formattedNEmotion}\n${loisDescription}`);
    }

    // 로이스 삭제 명령어
    async handleDeleteLois(message, args) {
        if (args.length < 1) {
            return message.channel.send('❌ 사용법: `!로이스삭제 ["로이스 이름"]`');
        }

        const loisName = utils.extractName(args.join(' '));
        const activeChar = this.getActiveCharacter(message);

        if (!activeChar) {
            return message.reply(`❌ 활성화된 캐릭터가 없습니다. \`!지정 ["캐릭터 이름"]\` 명령어로 캐릭터를 지정해주세요.`);
        }

        if (!activeChar.data.lois) {
            return message.channel.send(`❌ **${activeChar.name}**에게 등록된 로이스가 없습니다.`);
        }

        const loisList = activeChar.data.lois;
        const index = loisList.findIndex(lois => lois.name === loisName);

        if (index === -1) {
            return message.channel.send(`❌ **${activeChar.name}**에게 **"${loisName}"** 로이스가 존재하지 않습니다.`);
        }

        loisList.splice(index, 1);
        utils.saveData(data);

        message.channel.send(`🗑️ **${activeChar.name}**의 로이스 **"${loisName}"**가 삭제되었습니다.`);
    }

    // 타이터스 명령어
    async handleTitus(message, args) {
        if (args.length < 1) {
            return message.channel.send('❌ 사용법: `!타이터스 ["로이스 이름"]`');
        }

        const loisName = utils.extractName(args.join(' '));
        const activeChar = this.getActiveCharacter(message);

        if (!activeChar) {
            return message.reply(`❌ 활성화된 캐릭터가 없습니다. \`!지정 ["캐릭터 이름"]\` 명령어로 캐릭터를 지정해주세요.`);
        }

        if (!activeChar.data.lois) {
            return message.channel.send(`❌ **${activeChar.name}**에게 등록된 로이스가 없습니다.`);
        }

        const loisList = activeChar.data.lois;
        const index = loisList.findIndex(lois => lois.name === loisName);

        if (index === -1) {
            return message.channel.send(`❌ **${activeChar.name}**에게 **"${loisName}"** 로이스가 존재하지 않습니다.`);
        }

        // 침식률 상승 (타이터스로 변환할 때 +5 적용)
        activeChar.data['침식률'] = (activeChar.data['침식률'] || 0) + 5;

        // 로이스 삭제
        loisList.splice(index, 1);
        utils.saveData(data);

        message.channel.send(`🔥 **${activeChar.name}**의 로이스 **"${loisName}"**가 타이터스로 변환되었습니다!`);
    }

    // 리셋 명령어
    async handleReset(message, args) {
        const activeChar = this.getActiveCharacter(message);
        if (!activeChar) {
            return message.reply(`❌ 활성화된 캐릭터가 없습니다. \`!지정 ["캐릭터 이름"]\` 명령어로 캐릭터를 지정해주세요.`);
        }

        const { serverId, userId, name } = activeChar;

        // 전체 리셋
        if (args.length === 0) {
            delete data[serverId][userId][name];
            if (comboData[serverId]?.[userId]?.[name]) {
                delete comboData[serverId][userId][name];
            }
            utils.saveData(data);
            utils.saveComboData(comboData);
            return message.channel.send(`✅ **${name}**의 모든 데이터가 초기화되었습니다.`);
        }

        const resetType = args.join(' ').toLowerCase();

        // 콤보 리셋
        if (resetType === "콤보") {
            if (comboData[serverId]?.[userId]?.[name]) {
                delete comboData[serverId][userId][name];
            }
            utils.saveComboData(comboData);
            return message.channel.send(`✅ **${name}**의 모든 콤보가 삭제되었습니다.`);
        }

        // 로이스 리셋
        if (resetType === "로이스") {
            if (activeChar.data.lois) {
                delete activeChar.data.lois;
                utils.saveData(data);
                return message.channel.send(`✅ **${name}**의 모든 로이스가 삭제되었습니다.`);
            } else {
                return message.channel.send(`⚠️ **${name}**에게 등록된 로이스가 없습니다.`);
            }
        }

        // 특정 속성 리셋
        if (activeChar.data[resetType] !== undefined) {
            delete activeChar.data[resetType];
            utils.saveData(data);
            return message.channel.send(`✅ **${name}**의 '${resetType}' 데이터가 초기화되었습니다.`);
        } else {
            return message.channel.send(`⚠️ **${name}**의 '${resetType}' 데이터를 찾을 수 없습니다.`);
        }
    }

    // 캐릭터 삭제 명령어
    async handleDeleteCharacter(message, args) {
        if (!message.guild) return;

        const serverId = message.guild.id;
        const userId = message.author.id;

        const regex = /^(?:"([^"]+)"|\[([^\]]+)\]|(\S+))$/;
        const match = args.join(' ').match(regex);

        if (!match) {
            return message.channel.send('❌ 사용법: `!캐릭터삭제 "캐릭터 이름"` 또는 `!캐릭터삭제 [캐릭터 이름]`');
        }

        const characterName = match[1] || match[2] || match[3];

        if (!data[serverId]?.[userId]?.[characterName]) {
            return message.channel.send(`❌ **"${characterName}"** 캐릭터를 찾을 수 없습니다.`);
        }

        // 캐릭터 데이터 삭제
        delete data[serverId][userId][characterName];

        // 해당 캐릭터의 콤보 데이터도 삭제
        if (comboData[serverId]?.[userId]?.[characterName]) {
            delete comboData[serverId][userId][characterName];
            utils.saveComboData(comboData);
        }

        // 활성 캐릭터가 삭제된 캐릭터라면 초기화
        if (activeCharacter[serverId]?.[userId] === characterName) {
            delete activeCharacter[serverId][userId];
            utils.saveActiveCharacter(activeCharacter);
        }

        utils.saveData(data);
        message.channel.send(`✅ **"${characterName}"** 캐릭터가 삭제되었습니다.`);
    }

    // 업데이트 명령어
    async handleUpdate(message, args) {
        if (message.author.id !== BOT_OWNER_ID) {
            return message.channel.send("❌ 이 명령어는 봇 소유자만 사용할 수 있습니다.");
        }

        const updateType = args[0] || "patch";
        const announcementMessage = args.slice(1).join(' ');

        // 버전 업데이트 처리
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

        utils.saveVersion(currentVersion);

        const newVersion = `v${currentVersion.major}.${currentVersion.minor}.${currentVersion.patch}`;
        const finalMessage = `📢 **DX3bot 업데이트: ${newVersion}**\n${announcementMessage || "새로운 기능이 추가되었습니다!"}`;

        // 모든 서버에 공지 전송
        client.guilds.cache.forEach(async (guild) => {
            try {
                // 기본 채널 찾기
                const defaultChannel = guild.channels.cache.find(channel => 
                    channel.type === 0 && channel.permissionsFor(client.user).has("SendMessages")
                );

                if (defaultChannel) {
                    await defaultChannel.send(finalMessage);
                    console.log(`✅ 서버 "${guild.name}"에 업데이트 공지를 전송했습니다.`);
                } else {
                    // 채널이 없으면 서버 관리자에게 DM
                    const owner = await guild.fetchOwner();
                    if (owner) {
                        await owner.send(finalMessage);
                        console.log(`📩 서버 "${guild.name}"의 관리자에게 DM으로 공지를 전송했습니다.`);
                    }
                }
            } catch (error) {
                console.error(`❌ 서버 "${guild.name}"에 공지를 보내는 중 오류 발생:`, error);
            }
        });

        // 봇 소유자에게도 DM 전송
        try {
            const botOwner = await client.users.fetch(BOT_OWNER_ID);
            if (botOwner) {
                await botOwner.send(finalMessage);
            }
        } catch (error) {
            console.error("❌ 봇 소유자 DM 전송 실패:", error);
        }

        message.channel.send(`✅ **업데이트 완료! 현재 버전: ${newVersion}**`);
    }

    // 캐릭터 속성 설정 공통 함수
    async updateCharacterAttribute(message, attribute, value) {
        const activeChar = this.getActiveCharacter(message);
        if (!activeChar) {
            return message.channel.send(`❌ 활성화된 캐릭터가 없습니다. \`!지정 [캐릭터 이름]\` 명령어로 캐릭터를 지정해주세요.`);
        }

        activeChar.data[attribute] = value;
        utils.saveData(data);

        message.channel.send(`✅ **${activeChar.name}**의 **${attribute}**이(가) **"${value}"**(으)로 설정되었습니다.`);
    }

    // 캐릭터 속성 설정 명령어들
    async handleCodeName(message, args) {
        if (args.length === 0) return message.channel.send('❌ 사용법: `!코드네임 "코드네임"`');
        const codeName = utils.extractName(args.join(' '));
        await this.updateCharacterAttribute(message, 'codeName', codeName);
    }

    async handleEmoji(message, args) {
        if (args.length === 0) return message.channel.send('❌ 사용법: `!이모지 [이모지]`');
        await this.updateCharacterAttribute(message, 'emoji', args[0]);
    }

    async handleCover(message, args) {
        if (args.length === 0) return message.channel.send('❌ 사용법: `!커버 [이름]`');
        await this.updateCharacterAttribute(message, 'cover', args.join(' '));
    }

    async handleWorks(message, args) {
        if (args.length === 0) return message.channel.send('❌ 사용법: `!웍스 [이름]`');
        await this.updateCharacterAttribute(message, 'works', args.join(' '));
    }

    async handleBreed(message, args) {
        if (args.length === 0) return message.channel.send('❌ 사용법: `!브리드 [이름]`');
        await this.updateCharacterAttribute(message, 'breed', args.join(' '));
    }

    async handleSyndrome(message, args) {
        if (args.length < 1 || args.length > 3) {
            return message.channel.send('❌ 사용법: `!신드롬 [신드롬1] [신드롬2] [신드롬3]` (최대 3개)');
        }
        const translatedSyndromes = args.map(convertSyndromeToEnglish).join(" × ");
        await this.updateCharacterAttribute(message, 'syndromes', translatedSyndromes);
    }

    async handleAwakening(message, args) {
        if (args.length === 0) return message.channel.send('❌ 사용법: `!각성 [이름]`');
        await this.updateCharacterAttribute(message, 'awakening', args.join(' '));
    }

    async handleImpulse(message, args) {
        if (args.length === 0) return message.channel.send('❌ 사용법: `!충동 [이름]`');
        await this.updateCharacterAttribute(message, 'impulse', args.join(' '));
    }

    async handleDLois(message, args) {
        if (args.length < 2) {
            return message.channel.send('❌ 사용법: `!D로 [번호] [이름]`');
        }
        const dloisNo = args[0];
        const dloisName = args.slice(1).join(' ');
        
        const activeChar = this.getActiveCharacter(message);
        if (!activeChar) {
            return message.channel.send(`❌ 활성화된 캐릭터가 없습니다.`);
        }

        activeChar.data.dloisNo = dloisNo;
        activeChar.data.dloisName = dloisName;
        utils.saveData(data);

        message.channel.send(`✅ **${activeChar.name}**의 D-Lois가 설정되었습니다.`);
    }

    // 상태 변경 명령어 처리
    async handleStatChange(message) {
        const activeChar = this.getActiveCharacter(message);
        if (!activeChar) {
            return message.reply(`❌ 활성화된 캐릭터가 없습니다. \`!지정 [캐릭터 이름]\` 명령어로 캐릭터를 지정해주세요.`);
        }

        const statMatch = message.content.match(/^!([가-힣A-Za-z]+)([+=\-]\d+)$/);
        if (!statMatch) return;

        const statName = statMatch[1];
        const operation = statMatch[2];
        
        if (statName === "로이스") {
            return message.reply(`'로이스'는 이 명령어로 조정할 수 없습니다. \`!로이스\` 명령어를 사용하세요.`);
        }

        let newValue = activeChar.data[statName] || 0;

        if (operation.startsWith('+')) {
            newValue += parseInt(operation.slice(1));
        } else if (operation.startsWith('-')) {
            newValue -= parseInt(operation.slice(1));
        } else if (operation.startsWith('=')) {
            newValue = parseInt(operation.slice(1));
        }

        activeChar.data[statName] = newValue;

        // 침식률에 따른 침식D 증가 체크
        if (statName === '침식률') {
            this.updateErosionD(activeChar.data, message);
        }

        utils.saveData(data);
        message.reply(`▶ **${activeChar.name}**\n현재 **${statName}:** ${newValue}`);
    }

    // 침식D 업데이트 로직
    updateErosionD(characterData, message) {
        const currentErosion = characterData['침식률'] || 0;
        const currentErosionD = characterData['침식D'] || 0;

        for (const threshold of EROSION_THRESHOLDS) {
            if (currentErosion >= threshold.erosion && currentErosionD < threshold.d) {
                characterData['침식D'] = threshold.d;
                message.channel.send(`⚠️ 침식률이 ${threshold.erosion}을 넘어서 **침식D가 ${threshold.d}**로 상승했습니다.`);
                break;
            }
        }
    }

    // 에러 처리
    async handleError(message, error) {
        console.error('명령어 처리 중 오류 발생:', error);
        
        if (error.code === 50013) {
            console.error(`❌ 서버 "${message.guild.name}"에서 메시지를 보낼 수 있는 권한이 없음.`);
            try {
                const owner = await message.guild.fetchOwner();
                if (owner) {
                    await owner.send(
                        `❌ **DX3bot이 "${message.guild.name}" 서버에서 메시지를 보낼 수 없습니다.**\n봇의 권한을 확인해주세요!`
                    );
                }
            } catch (dmError) {
                console.error('서버 소유자 DM 전송 실패:', dmError);
            }
        }

        // 봇 관리자에게 오류 알림
        if (BOT_OWNER_ID) {
            try {
                const owner = await client.users.fetch(BOT_OWNER_ID);
                if (owner) {
                    await owner.send(`🚨 **DX3bot 오류 발생!**\n\`\`\`${error.stack || error.message}\`\`\``);
                }
            } catch (fetchError) {
                console.error('봇 관리자 오류 알림 전송 실패:', fetchError);
            }
        }
    }
}

// 이벤트 핸들러 설정
const commandHandler = new CommandHandler();

client.once(Events.ClientReady, readyClient => {
    console.log(`✅ Ready! Logged in as ${readyClient.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    await commandHandler.handle(message);
});

// 주사위 봇 결과 처리
client.on('messageCreate', async (diceMessage) => {
    if (!diceMessage.author.bot) return;

    const diceResultMatch = diceMessage.content.match(/(?:\(\d+D\d+\)|＞.*?)\s*＞\s*(\d+)/);
    if (!diceResultMatch) return;

    const diceResult = parseInt(diceResultMatch[1]);
    const serverId = diceMessage.guild?.id;
    
    if (!serverId || !erosionRequesters[serverId]) return;

    const userId = Object.keys(erosionRequesters[serverId])[0];
    if (!userId) return;

    const activeCharacterName = erosionRequesters[serverId][userId];
    delete erosionRequesters[serverId][userId];

    if (!data[serverId]?.[userId]?.[activeCharacterName]) return;

    const currentStatus = data[serverId][userId][activeCharacterName];
    const newErosion = (currentStatus['침식률'] || 0) + diceResult;
    currentStatus['침식률'] = newErosion;

    // 침식D 업데이트
    commandHandler.updateErosionD(currentStatus, diceMessage);

    utils.saveData(data);
    diceMessage.channel.send(
        `${activeCharacterName} 등장침식 +${diceResult} → 현재 침식률: ${newErosion}\n <@${userId}>`
    );
});

// BCdice 봇 깨우기 (12시간마다)
const targetBotTag = "BCdicebot#8116";
const diceCommand = "bcdice set DoubleCross:Korean";
const interval = 12 * 60 * 60 * 1000;

setInterval(() => {
    client.guilds.cache.forEach(guild => {
        const targetBot = guild.members.cache.find(member => member.user.tag === targetBotTag);
        if (targetBot) {
            const textChannel = guild.channels.cache.find(channel => 
                channel.type === 0 && channel.permissionsFor(client.user).has("SendMessages")
            );
            if (textChannel) {
                textChannel.send(diceCommand)
                    .then(() => console.log(`✅ BCdicebot을 깨웠습니다: ${guild.name}`))
                    .catch(err => console.error(`❌ BCdicebot 메시지 전송 실패 (${guild.name}):`, err));
            }
        }
    });
}, interval);

// 전역 오류 처리
client.on('error', async (error) => {
    console.error("🚨 [봇 오류 발생]:", error);
    
    if (BOT_OWNER_ID) {
        try {
            const owner = await client.users.fetch(BOT_OWNER_ID);
            if (owner) {
                await owner.send(`🚨 **DX3bot 오류 발생!**\n\`\`\`${error.stack || error.message}\`\`\``);
            }
        } catch (fetchError) {
            console.error("❌ 봇 관리자 정보를 가져오는 중 오류 발생:", fetchError);
        }
    }
});

// Unhandled Promise Rejection 처리
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Uncaught Exception 처리
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // 봇을 강제로 종료하지 않고 계속 실행
});

// 정상 종료 처리
process.on('SIGINT', () => {
    console.log('✅ 봇이 정상적으로 종료됩니다...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('✅ 봇이 정상적으로 종료됩니다...');
    client.destroy();
    process.exit(0);
});

// 봇 로그인
client.login(token)
    .then(() => {
        console.log("✅ 디스코드 봇이 성공적으로 시작되었습니다!");
    })
    .catch((error) => {
        console.error("❌ 봇 로그인 실패:", error);
        process.exit(1);
    });



