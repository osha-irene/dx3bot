// 필요한 모듈 가져오기
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Events } = require('discord.js');

// 디스코드 클라이언트 설정
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// 데이터 파일 경로
const dataFilePath = path.join(__dirname, 'data.json');

// 데이터 로드 함수
const loadData = () => {
  if (!fs.existsSync(dataFilePath)) {
    fs.writeFileSync(dataFilePath, JSON.stringify({})); // 파일이 없으면 새로 생성
  }
  return JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
};

// 데이터 저장 함수
const saveData = (data) => {
  fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
};

// 캐릭터 데이터 관리 객체
let sheetData = loadData();
let activeCharacter = {}; // 유저별 활성 캐릭터 저장

// 캐릭터 데이터 저장 함수 (추가)
const setCharacterData = (characterName, attribute, value) => {
  if (!sheetData[characterName]) sheetData[characterName] = {};
  sheetData[characterName][attribute] = value;
  saveData(sheetData);
};


client.once('ready', async () => {
	client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}!`);

    // 실행 중 봇 이름 변경 (1시간 제한)
    try {
        await client.user.setUsername("dx3bot");
        console.log("✅ 봇 이름이 dx3bot으로 변경되었습니다!");
    } catch (error) {
        console.error("❌ 봇 이름 변경 실패 (디스코드 제한 가능):", error);
    }
    // 봇이 실행된 후 처음으로 메시지를 보낼 채널 찾기
    client.guilds.cache.forEach(async guild => {
        let defaultChannel;
        
        // 서버에서 기본적으로 사용할 채널 찾기
        guild.channels.cache.forEach(channel => {
            if (channel.type === 0 && !defaultChannel) { // type 0 = 텍스트 채널
                defaultChannel = channel;
            }
        });

        if (defaultChannel) {
            defaultChannel.send(
                `✅ **dx3bot이 정상적으로 실행되었습니다!**  
		💬 명령어를 확인하려면 **\`!도움\`**을 입력하세요.  
		📜 사용 가능한 기능을 확인하고 싶다면 **\`!도움\`** 명령어를 사용해 주세요!`
            );
        }
    });
});
});


// 봇이 준비됐을 때 표시할 메시지
client.once(Events.ClientReady, readyClient => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// 메시지 이벤트 핸들러
client.on('messageCreate', (message) => {
  if (message.author.bot) return; // 봇이 보낸 메시지는 무시

  const data = loadData();
  const args = message.content.trim().split(' ');
  

// !도움 명령어
if (message.content.startsWith('!도움')) {
    const helpMessage = `
📖 **SHEETbot 명령어 가이드** 📖

🔹 **캐릭터 관리**
> \`!시트입력 "캐릭터 이름" 항목1 값1 항목2 값2 ...\`  
>  새로운 캐릭터를 등록하거나 기존 캐릭터의 정보를 수정합니다.  
> 💡 예시: \`!시트입력 "캬 린트" 육체 3 감각 6\`

> \`!지정 "캐릭터 이름"\`  
>  특정 캐릭터를 활성화합니다.  
> 💡 예시: \`!지정 "캬 린트"\`

> \`!지정해제\`  
>  현재 활성화된 캐릭터를 해제합니다.

> \`!시트확인\`  
>  현재 활성화된 캐릭터의 정보를 확인합니다.

🔹 **상태 변경**
> \`!침식률+N\`, \`!HP-10\`, \`!로이스-3\`  
>  특정 능력치 값을 증가/감소/설정합니다.  
> 💡 예시: \`!침식률+5\`

🔹 **판정 시스템**
> \`!판정 항목\`  
>  해당 능력으로 주사위를 굴립니다. 침식D가 자동 적용됩니다.  
> 💡 예시: \`!판정 백병\`

🔹 **등장 침식**
> \`!등침\`, \`!등장침식\`  
>  등장 시 \`1d10\`을 굴려 침식률을 자동으로 추가합니다.
`;

    const helpMessage2 = `
🔹 **콤보 시스템**
> \`!콤보 "콤보 이름" 침식률조건 콤보 데이터\`  
>  침식률에 따라 특정 콤보를 저장합니다.  
> 💡 침식률 조건은 \`"99↓"\` 또는 \`"100↑"\` 같은 형식으로 설정됩니다.  
> 💡 예시:  
> \`!콤보 "연속 사격" 99↓ 《C: 발로르(2) + 흑의 철퇴(4)》\`  
> \`!콤보 [강력한 일격] 100↑ 《C: 키마이라(3) + 마수의 본능(2)》\`

> \`!@"콤보 이름"\`  
>  저장된 콤보를 침식률 기준으로 자동 검색해 출력합니다.  
> 💡 예시:  
> \`!@"연속 사격"\`  
> → 침식률이 99 이하라면 \"연속 사격\"의 99↓ 버전 출력  
> → 침식률이 100 이상이면 \"연속 사격\"의 100↑ 버전 출력  

⚠️ **주의:** 띄어쓰기 포함된 콤보명은 반드시 \"콤보 이름\" 또는 \[콤보 이름\] 형식으로 입력해야 합니다.
`;

    const helpMessage3 = `
🔹 **로이스 시스템**
> \`!로이스 "로이스 이름" P감정 N감정 내용\`  
>  새로운 로이스를 등록합니다.  
> 💡 예시:  
> \`!로이스 "어린 시절 친구" 애정* 불신 어린 시절 함께한 친구\`  
> \`!로이스 [배신자] 증오 분노* 나를 배신한 동료\`

> 📌 **P 감정 메인 설정**  
>  P 감정에 \`*\`을 붙이면 **메인 감정**으로 설정됩니다.  

> 📌 **출력 예시**
> ✅ 미잉의 로이스 "어린 시절 친구"가 등록되었습니다.  
>  【P: 애정】 / N: 불신  
>  어린 시절 함께한 친구

🔹 **로이스 관리**
> \`!로이스삭제 "로이스 이름"\`  
>  해당 로이스를 삭제합니다.  
> 💡 예시: \`!로이스삭제 "배신자"\`  

> \`!타이터스 "로이스 이름"\`  
>  해당 로이스를 타이터스로 변환합니다.  
> 💡 예시: \`!타이터스 "어린 시절 친구"\`  

🔹 **관리 명령어**
> \`!리셋\`  
>  현재 캐릭터의 모든 데이터를 초기화합니다.  

> \`!리셋 콤보\`  
>  등록된 콤보만 초기화합니다.  

> \`!리셋 로이스\`  
>  등록된 로이스만 초기화합니다.  

> \`!캐릭터삭제 "캐릭터 이름"\`  
>  해당 캐릭터의 데이터를 완전히 삭제합니다.

📢 **문의 / 개선 요청**  
봇 사용 중 문제가 발생하면 **오샤님**에게 문의하세요!
`;

    // 메시지를 3개로 나눠서 전송 (디스코드 2000자 제한 고려)
    message.channel.send(helpMessage);
    message.channel.send(helpMessage2);
    message.channel.send(helpMessage3);
}


  // 상위 항목 강제 매핑을 위한 규칙
const mainAttributes = ['육체', '감각', '정신', '사회']; // 상위 항목

  const subToMainMapping = {
    '백병': '육체',
    '회피': '육체',
    '사격': '감각',
    '지각': '감각',
    'RC': '정신',
    '의지': '정신',
    '교섭': '사회',
    '조달': '사회',
  };
  // 동적 항목 매핑
const dynamicMappingRules = {
  '운전:': '육체',  // '운전:'은 '육체' 항목으로 강제 매핑
  '정보:': '사회',  // '정보:'는 '사회' 항목으로 강제 매핑
  '예술:': '감각',  // '예술:'은 '감각' 항목으로 강제 매핑
  '지식:': '정신',  // '지식:'은 '정신' 항목으로 강제 매핑
};

// !시트입력 명령어
if (message.content.startsWith('!시트입력')) {
    // 따옴표("") 또는 대괄호([])로 감싸진 캐릭터 이름을 정확하게 추출
    const regex = /^!시트입력\s+(?:"([^"]+)"|\[([^\]]+)\]|(\S+))\s+(.+)$/;
    const match = message.content.match(regex);

    if (!match) {
        return message.channel.send('❌ 사용법: `!시트입력 "캐릭터 이름" [항목1] [값1] [항목2] [값2] ...`');
    }

    // 캐릭터 이름 설정 (따옴표 또는 대괄호가 있으면 제거)
    const characterName = match[1] || match[2] || match[3];

    // 속성과 값을 분리
    const args = match[4].split(/\s+/);
    if (args.length < 2 || args.length % 2 !== 0) {
        return message.channel.send('❌ 속성은 최소한 하나 이상 입력해야 하며, 속성과 값은 짝수여야 합니다.');
    }

    // 데이터 초기화
    if (!data[message.author.id]) {
        data[message.author.id] = {};
    }
    if (!data[message.author.id][characterName]) {
        data[message.author.id][characterName] = {};
    }

    // 속성과 값 저장
    for (let i = 0; i < args.length; i += 2) {
        const attribute = args[i];
        const value = parseInt(args[i + 1]);

        if (isNaN(value)) {
            return message.channel.send(`❌ **${args[i + 1]}**는 숫자가 아닙니다. 숫자 값만 입력해주세요.`);
        }

        data[message.author.id][characterName][attribute] = value;
    }

    saveData(data);
    message.channel.send(`✅ **${characterName}**의 항목이 설정되었습니다.`);
}

 // 캐릭터 코드네임 저장 함수
const setCharacterCodeName = (userId, characterName, codeName) => {
  if (!data[userId]) data[userId] = {};
  if (!data[userId][characterName]) data[userId][characterName] = {};
  data[userId][characterName].codeName = codeName; // 코드네임 추가
  saveData(data);
};

// 서버별 활성 캐릭터 관리
let activeCharacter = {}; // { guildId: { userId: "캐릭터 이름" } }

// !지정 명령어
if (message.content.startsWith('!지정')) {
    if (!message.guild) return message.channel.send("❌ 이 명령어는 서버에서만 사용할 수 있습니다.");

    const args = message.content.match(/"(.*?)"|(\S+)/g);
    if (!args || args.length < 2) {
        return message.channel.send('❌ 사용법: `!지정 "캐릭터 이름"`');
    }

    const guildId = message.guild.id;
    const userId = message.author.id;
    const characterName = args.slice(1).join(' ').replace(/["']/g, '');  

    if (!data[userId] || !data[userId][characterName]) {
        return message.channel.send(`❌ **"${characterName}"**의 데이터를 찾을 수 없습니다.\n먼저 \`!시트입력\`으로 캐릭터를 등록하세요.`);
    }

    if (!activeCharacter[guildId]) {
        activeCharacter[guildId] = {}; // 서버별 데이터 구조 초기화
    }

    activeCharacter[guildId][userId] = characterName;
    message.channel.send(`✅ **${characterName}**님을 활성 캐릭터로 지정했습니다.`);
}

if (message.content === '!지정해제') {
    if (!message.guild) return message.channel.send("❌ 이 명령어는 서버에서만 사용할 수 있습니다.");

    const guildId = message.guild.id;
    const userId = message.author.id;

    if (!activeCharacter[guildId] || !activeCharacter[guildId][userId]) {
        return message.reply("❌ 현재 활성화된 캐릭터가 없습니다.");
    }

    const prevCharacter = activeCharacter[guildId][userId];
    delete activeCharacter[guildId][userId];

    return message.channel.send(`✅ **${prevCharacter}**님을 활성 캐릭터에서 해제했습니다.`);
}


// !코드네임 명령어 처리
if (message.content.startsWith('!코드네임')) {
  const match = message.content.match(/^!코드네임\s+(?:"([^"]+)"|\[([^\]]+)\]|(.+))$/);
  if (!match) {
    return message.channel.send('❌ 사용법: `!코드네임 "코드네임"` 또는 `!코드네임 [코드네임]`');
  }

  const codeName = match[1] || match[2] || match[3];

  const activeCharacterName = activeCharacter[message.author.id];
  if (!activeCharacterName || !data[message.author.id] || !data[message.author.id][activeCharacterName]) {
    return message.channel.send(`${message.author.tag}님, 활성화된 캐릭터가 없습니다. \`!지정 [캐릭터 이름]\` 명령어로 캐릭터를 지정해주세요.`);
  }

  // 코드네임 저장
  data[message.author.id][activeCharacterName].codeName = codeName;
  saveData(data);
  
  message.channel.send(`✅ **${activeCharacterName}**의 코드네임이 **"${codeName}"**(으)로 설정되었습니다.`);
}


if (message.content.startsWith('!코드네임')) {
    if (!message.guild) return message.channel.send("❌ 이 명령어는 서버에서만 사용할 수 있습니다.");

    const guildId = message.guild.id;
    const userId = message.author.id;
    const activeCharacterName = activeCharacter[guildId]?.[userId];

    if (!activeCharacterName || !data[userId] || !data[userId][activeCharacterName]) {
        return message.channel.send("❌ 활성화된 캐릭터가 없습니다.\n`!지정 [캐릭터 이름]` 명령어로 캐릭터를 지정해주세요.");
    }

    const match = message.content.match(/^!코드네임\s+(?:"([^"]+)"|\[([^\]]+)\]|(.+))$/);
    if (!match) {
        return message.channel.send('❌ 사용법: `!코드네임 "코드네임"` 또는 `!코드네임 [코드네임]`');
    }

    const codeName = match[1] || match[2] || match[3];
    data[userId][activeCharacterName].codeName = codeName;
    saveData(data);

    message.channel.send(`✅ **${activeCharacterName}**의 코드네임이 **"${codeName}"**(으)로 설정되었습니다.`);
}


// 콤보 데이터를 저장할 객체
let comboData = {};

// 콤보 데이터 저장 및 불러오기
function saveComboData() {
  fs.writeFileSync('comboData.json', JSON.stringify(comboData, null, 2));
}
function loadComboData() {
  if (fs.existsSync('comboData.json')) {
    comboData = JSON.parse(fs.readFileSync('comboData.json', 'utf8'));
  }
}
loadComboData(); // 실행 시 저장된 콤보 불러오기


// !시트확인 명령어 (서버별 작동)
if (message.content.startsWith('!시트확인')) {
    if (!message.guild) return message.channel.send("❌ 이 명령어는 서버에서만 사용할 수 있습니다.");

    const guildId = message.guild.id;
    const userId = message.author.id;
    const activeCharacterName = activeCharacter[guildId]?.[userId];

    if (!activeCharacterName || !data[userId] || !data[userId][activeCharacterName]) {
        return message.reply(`${message.author.tag}님, 활성화된 캐릭터가 없습니다. \`!지정 ["캐릭터 이름"]\` 명령어로 캐릭터를 지정해주세요.`);
    }

    const characterData = data[userId][activeCharacterName];
    const characterCodeName = characterData.codeName || '코드네임 없음';
    console.log(`코드네임 확인 - 캐릭터: ${activeCharacterName}, 코드네임: ${characterCodeName}`);

    // 로이스가 배열인지 확인 후 변환
    if (!Array.isArray(characterData.lois)) {
        characterData.lois = [];
    }

    let response = `**현재 활성 캐릭터:** **${activeCharacterName}** :: ${characterCodeName} (${message.author.tag})\n`;

    // 기본 스테이터스 출력
    response += `\n**📌 기본 스테이터스**\n`;
    response += `> **HP:** ${characterData.HP || 0}  **침식률:** ${characterData.침식률 || 0}  **침식D:** ${characterData.침식D || 0}  **로이스:** ${characterData.lois.length}\n`;
    response += `\n**📌 능력치**\n`;

    // 상위 항목 리스트
    const mainAttributes = ['육체', '감각', '정신', '사회'];

    // 하위 항목 매핑 규칙
    const subToMainMapping = {
        '백병': '육체', '회피': '육체',
        '사격': '감각', '지각': '감각',
        'RC': '정신', '의지': '정신',
        '교섭': '사회', '조달': '사회',
    };

    // 동적 항목 매핑
    const dynamicMappingRules = {
        '운전:': '육체',
        '정보:': '사회',
        '예술:': '감각',
        '지식:': '정신'
    };

    // 각 상위 항목에 대해 하위 항목을 찾고 출력
    for (let mainAttr of mainAttributes) {
        let subAttributes = [];
        let mainAttrValue = characterData[mainAttr] || 0;

        // 하위 항목 검색 및 매핑
        for (let [key, value] of Object.entries(characterData)) {
            if (subToMainMapping[key] === mainAttr) {
                subAttributes.push(`${key}: ${value}`);
            } else {
                for (let prefix in dynamicMappingRules) {
                    if (key.startsWith(prefix) && dynamicMappingRules[prefix] === mainAttr) {
                        subAttributes.push(`${key}: ${value}`);
                    }
                }
            }
        }

        // 상위 항목 출력
        if (subAttributes.length > 0 || mainAttrValue !== 0) {
            response += `> **【${mainAttr}】** ${mainAttrValue} ` + subAttributes.join(' ') + '\n';
        }
    }

    // 🔹 콤보 출력 (등록된 콤보가 있을 경우)
    if (comboData[activeCharacterName] && Object.keys(comboData[activeCharacterName]).length > 0) {
        response += `\n**📌 콤보**\n`;
        for (let comboName in comboData[activeCharacterName]) {
            response += `> **${comboName}**\n`;
        }
    }

    // 🔹 로이스 출력 (등록된 로이스가 있을 경우)
    if (characterData.lois && characterData.lois.length > 0) {
        response += `\n**📌 로이스**\n`;
        for (let lois of characterData.lois) {
            response += `> **${lois.name}** | ${lois.pEmotion} / ${lois.nEmotion} | ${lois.description}\n`;
        }
    }

    return message.reply(response);
}



// !판정 명령어 처리
if (message.content.startsWith('!판정')) {
  const args = message.content.split(' ').slice(1);
  if (args.length < 1) {
    return message.channel.send('사용법: !판정 [항목]');
  }

  let attribute = args[0];
  let activeCharacterName = activeCharacter[message.author.id];

  if (activeCharacterName) {
    // data.json 파일을 읽어옴
    fs.readFile('data.json', 'utf8', (err, data) => {
      if (err) {
        console.error('파일을 읽는 데 오류가 발생했습니다:', err);
        return message.channel.send('데이터 파일을 불러오는 데 문제가 발생했습니다.');
      }

      // data.json 파싱
      let sheetData;
      try {
        sheetData = JSON.parse(data);
      } catch (parseErr) {
        console.error('데이터 파싱 오류:', parseErr);
        return message.channel.send('데이터 파일 파싱에 실패했습니다.');
      }

      // activeCharacterName에 해당하는 데이터가 존재하는지 확인
      if (!sheetData[message.author.id] || !sheetData[message.author.id][activeCharacterName]) {
        return message.channel.send(`${activeCharacterName} 캐릭터 데이터를 찾을 수 없습니다.`);
      }


      // 동적 항목이 상위 항목에 매핑되도록 강제 처리
      let mainAttr = attribute;
      
      // 동적 항목이 있는 경우, 상위 항목으로 매핑
      for (let key in dynamicMappingRules) {
        if (attribute.startsWith(key)) {
          mainAttr = dynamicMappingRules[key];  // 예: '운전:'은 '육체'로 매핑
          break;  // 매핑된 항목이 있으면 강제로 변경
        }
      }


      // 동적 항목이 있는 경우, 강제로 상위 항목과 매핑
      for (let key in subToMainMapping) {
        if (attribute.startsWith(key)) {
          mainAttr = subToMainMapping[key];  // 예: '운전:4륜' → '육체'
          break;
        }
      }

      // 상위 항목 값 가져오기
      const mainValue = sheetData[message.author.id][activeCharacterName][mainAttr];  
      const subValue = sheetData[message.author.id][activeCharacterName][attribute]; 

      // 침식D 값 가져오기
      const chimiskD = sheetData[message.author.id][activeCharacterName].침식D || 0;

      // 로그 추가
      console.log(`활성화된 캐릭터: ${activeCharacterName}`);
      console.log(`올바른 상위 항목: ${mainAttr}, 상위 항목 값: ${mainValue}`);
      console.log(`하위 항목: ${attribute}, 하위 항목 값: ${subValue}`);
      console.log(`침식D 값: ${chimiskD}`);

      if (mainValue !== undefined && subValue !== undefined) {
        const finalMainValue = `(${mainValue}+${chimiskD})dx`;
        const finalResult = `${finalMainValue}+${subValue}`;
        message.channel.send(`${finalResult}  ${attribute} 판정 <@${message.author.id}>`);
      } else {
        message.channel.send(`${activeCharacterName} ${attribute} 값을 찾을 수 없습니다.`);
      }
    });
  } else {
    message.channel.send(`${message.author.tag}님, 활성화된 캐릭터가 없습니다. \`!지정 [캐릭터 이름]\` 명령어로 캐릭터를 지정해주세요.`);
  }
}



 // !침식률+4, !HP=0 등의 명령어 처리 (활성 캐릭터 기반)
if (args[0].startsWith('!') && (args[0].includes('+') || args[0].includes('-') || args[0].includes('='))) {
  const statMatch = args[0].match(/^!([가-힣A-Za-z]+)([+=\-]\d+)$/);
  if (statMatch) {
    const statName = statMatch[1];  // 예: '침식률', 'HP'
    const operation = statMatch[2];  // 예: '+4', '-1', '=0'
    const activeCharacterName = activeCharacter[message.author.id];

    if (!activeCharacterName || !data[message.author.id] || !data[message.author.id][activeCharacterName]) {
      return message.reply(`${message.author.tag}님, 활성화된 캐릭터가 없습니다. \`!지정 [캐릭터 이름]\` 명령어로 캐릭터를 지정해주세요.`);
    }

    // 로이스 조정 기능 제외
    if (statName === "로이스") {
      return message.reply(`'로이스'는 이 명령어로 조정할 수 없습니다. \`!로이스\` 명령어를 사용하세요.`);
    }

    let currentStatus = data[message.author.id][activeCharacterName];
    let newValue = currentStatus[statName] || 0;

    // 연산 수행
    if (operation.startsWith('+')) {
      newValue += parseInt(operation.slice(1)); // '+' 뒤의 숫자를 더하기
    } else if (operation.startsWith('-')) {
      newValue -= parseInt(operation.slice(1)); // '-' 뒤의 숫자를 빼기
    } else if (operation.startsWith('=')) {
      newValue = parseInt(operation.slice(1)); // '=' 뒤의 숫자를 설정
    }

    // 업데이트된 값을 저장
    currentStatus[statName] = newValue;

    // 침식률에 따른 침식D 증가
    if (statName === '침식률') {
      let currentChimiskRate = currentStatus['침식률'];
      let currentChimiskD = currentStatus['침식D'] || 0;
      
      // 침식률이 기준값을 초과하면 침식D가 증가
      if (currentChimiskRate >= 60 && currentChimiskD < 1) {
        currentStatus['침식D'] = 1;
        message.channel.send('침식률이 60을 넘어서 침식D가 상승했습니다.');
      }
      if (currentChimiskRate >= 80 && currentChimiskD < 2) {
        currentStatus['침식D'] = 2;
        message.channel.send('침식률이 80을 넘어서 침식D가 상승했습니다.');
      }
      if (currentChimiskRate >= 100 && currentChimiskD < 3) {
        currentStatus['침식D'] = 3;
        message.channel.send('침식률이 100을 넘어서 침식D가 상승했습니다.');
      }
      if (currentChimiskRate >= 130 && currentChimiskD < 4) {
        currentStatus['침식D'] = 4;
        message.channel.send('침식률이 130을 넘어서 침식D가 상승했습니다.');
      }
      if (currentChimiskRate >= 190 && currentChimiskD < 5) {
        currentStatus['침식D'] = 5;
        message.channel.send('침식률이 190을 넘어서 침식D가 상승했습니다.');
      }
    }

    saveData(data); // 데이터 저장 함수 호출

    // 변경된 항목만 출력
    let updatedStatus = `▶ ${activeCharacterName}\n 현재 ${statName}: ${newValue}`;

    return message.reply(updatedStatus);
  }
}


   // !캐릭터리셋 명령어 처리
  if (message.content.startsWith('!캐릭터리셋')) {
    const args = message.content.split(' ').slice(1);
    const activeCharacterName = activeCharacter[message.author.id];

    if (!activeCharacterName) {
      return message.channel.send(`${message.author.tag}님, 활성화된 캐릭터가 없습니다.`);
    }

    if (args.length === 0) {
      // 모든 데이터 리셋
      sheetData[activeCharacterName] = {};
      message.channel.send(`${activeCharacterName}의 모든 값이 리셋되었습니다.`);
    } else {
      const attribute = args[0];
      if (sheetData[activeCharacterName][attribute]) {
        delete sheetData[activeCharacterName][attribute];
        message.channel.send(`${activeCharacterName}의 ${attribute} 값이 리셋되었습니다.`);
      } else {
        message.channel.send(`${activeCharacterName}에 ${attribute} 값이 존재하지 않습니다.`);
      }
    }
  }
  
// !리셋 명령어 처리 (전체 리셋 또는 특정 데이터만 리셋)
if (message.content.startsWith('!리셋')) {
  const args = message.content.split(' ').slice(1);
  let activeCharacterName = activeCharacter[message.author.id];

  if (!activeCharacterName) {
    return message.reply(`${message.author.tag}님, 활성화된 캐릭터가 없습니다. \`!지정 ["캐릭터 이름"]\` 명령어로 캐릭터를 지정해주세요.`);
  }

  if (args.length === 0) {
    // 전체 리셋 (캐릭터 데이터 + 콤보 + 로이스 삭제)
    if (data[message.author.id] && data[message.author.id][activeCharacterName]) {
      delete data[message.author.id][activeCharacterName];
    }
    if (comboData[activeCharacterName]) {
      delete comboData[activeCharacterName];
    }

    saveData(data);
    saveComboData();

    return message.channel.send(`✅ **${activeCharacterName}**의 모든 데이터가 초기화되었습니다.`);
  } else {
    let resetType = args.join(' ').toLowerCase(); // 띄어쓰기를 포함한 명령어 처리

    if (resetType === "콤보") {
      // 콤보 데이터만 리셋
      if (comboData[activeCharacterName]) {
        delete comboData[activeCharacterName];
      }
      saveComboData();
      return message.channel.send(`✅ **${activeCharacterName}**의 모든 콤보가 삭제되었습니다.`);
    }

    if (resetType === "로이스") {
      // 로이스 데이터만 리셋
      if (data[message.author.id][activeCharacterName] && data[message.author.id][activeCharacterName].lois) {
        delete data[message.author.id][activeCharacterName].lois;
        saveData(data);
        return message.channel.send(`✅ **${activeCharacterName}**의 모든 로이스가 삭제되었습니다.`);
      } else {
        return message.channel.send(`⚠️ **${activeCharacterName}**에게 등록된 로이스가 없습니다.`);
      }
    }

    // 특정 항목만 리셋
    let statName = resetType;
    if (data[message.author.id][activeCharacterName] && data[message.author.id][activeCharacterName][statName] !== undefined) {
      delete data[message.author.id][activeCharacterName][statName];

      saveData(data);
      return message.channel.send(`✅ **${activeCharacterName}**의 '${statName}' 데이터가 초기화되었습니다.`);
    } else {
      return message.channel.send(`⚠️ **${activeCharacterName}**의 '${statName}' 데이터를 찾을 수 없습니다.`);
    }
  }
}



// 등장침식 요청을 보낸 사용자 추적
let erosionRequesters = {};

// !등침, !등장침식 명령어 처리 (1d10 굴려 침식률 증가)
if (message.content.startsWith('!등침') || message.content.startsWith('!등장침식')) {
  let activeCharacterName = activeCharacter[message.author.id];

  if (!activeCharacterName || !data[message.author.id] || !data[message.author.id][activeCharacterName]) {
    return message.reply(`${message.author.tag}님, 활성화된 캐릭터가 없습니다. \`!지정 [캐릭터 이름]\` 명령어로 캐릭터를 지정해주세요.`);
  }

  // 사용자 ID를 저장하여 후속 주사위 결과와 연결
  erosionRequesters[message.author.id] = activeCharacterName;

  // 주사위 굴리기 메시지 전송
  message.channel.send(`1d10 등장침식 <@${message.author.id}>`);
}

// 주사위 봇의 메시지를 감지하여 침식률에 반영
client.on('messageCreate', async (diceMessage) => {
  if (!diceMessage.author.bot) return; // 봇이 아닌 메시지는 무시

  console.log(`주사위 봇 메시지 감지: ${diceMessage.content}`); // 메시지 로깅

  // (1D10) ＞ 10 형식의 메시지를 감지
  const diceResultMatch = diceMessage.content.match(/(?:\(\d+D\d+\)|＞.*?)\s*＞\s*(\d+)/);
  if (!diceResultMatch) {
    console.log(`주사위 결과를 찾을 수 없음. 메시지 내용: ${diceMessage.content}`);
    return;
  }

  let diceResult = parseInt(diceResultMatch[1]); // 주사위 값 추출
  console.log(`추출된 주사위 값: ${diceResult}`);

  // 최근에 !등침을 요청한 사용자를 찾기
  let userId = Object.keys(erosionRequesters)[0]; // 가장 최근 요청자 가져오기
  if (!userId) {
    console.log(`주사위 결과를 적용할 사용자 없음.`);
    return;
  }

  let activeCharacterName = erosionRequesters[userId]; // 요청한 캐릭터 이름 가져오기
  delete erosionRequesters[userId]; // 사용 후 요청 목록에서 제거

  if (!data[userId] || !data[userId][activeCharacterName]) {
    console.log(`캐릭터 데이터를 찾을 수 없음.`);
    return;
  }

  let currentStatus = data[userId][activeCharacterName];

  // 기존 침식률 가져오기
  let newErosion = (currentStatus['침식률'] || 0) + diceResult;
  currentStatus['침식률'] = newErosion;

  // 침식D 증가 체크
  let currentChimiskD = currentStatus['침식D'] || 0;
  let newChimiskD = currentChimiskD;

  if (newErosion >= 60 && currentChimiskD < 1) newChimiskD = 1;
  if (newErosion >= 80 && currentChimiskD < 2) newChimiskD = 2;
  if (newErosion >= 100 && currentChimiskD < 3) newChimiskD = 3;
  if (newErosion >= 130 && currentChimiskD < 4) newChimiskD = 4;
  if (newErosion >= 190 && currentChimiskD < 5) newChimiskD = 5;

  if (newChimiskD > currentChimiskD) {
    currentStatus['침식D'] = newChimiskD;
    message.channel.send(`침식률이 ${newErosion}이 되어 침식D가 ${newChimiskD}로 증가했습니다.`);
  }

  saveData(data);

  // 결과 메시지 출력
  diceMessage.channel.send(
    `${activeCharacterName} 등장침식 +${diceResult} → 현재 침식률: ${newErosion}\n <@${userId}>`
  );
});

// 콤보 이름을 "" 또는 []로 감싸면 공백 포함 가능
function extractComboName(input) {
    let match = input.match(/^["'\[](.*?)["'\]]$/);
    return match ? match[1] : input;
}

// **🔹 !콤보 명령어 추가 (콤보 저장 기능)**
if (message.content.startsWith('!콤보')) {
    // 정규식으로 콤보명과 나머지 데이터 분리
    const regex = /^!콤보\s+(?:"([^"]+)"|\[([^\]]+)\]|(\S+))\s+(\S+)\s+(.+)$/;
    const match = message.content.match(regex);

    if (!match) {
        return message.channel.send('❌ 사용법: `!콤보 ["콤보 이름"] [침식률조건] [콤보 데이터]`');
    }

    // 따옴표 또는 대괄호가 있으면 제거하여 콤보 이름 추출
    let comboName = match[1] || match[2] || match[3];
    let condition = match[4];  // 침식률 조건 (99↓ 또는 100↑)
    let comboDescription = match[5];  // 콤보 데이터

    let activeCharacterName = activeCharacter[message.author.id];
    if (!activeCharacterName) {
        return message.reply(`${message.author.tag}님, 활성화된 캐릭터가 없습니다. \`!지정 ["캐릭터 이름"]\` 명령어로 캐릭터를 지정해주세요.`);
    }

    if (!comboData[activeCharacterName]) {
        comboData[activeCharacterName] = {};
    }

    if (!comboData[activeCharacterName][comboName]) {
        comboData[activeCharacterName][comboName] = {};
    }

    comboData[activeCharacterName][comboName][condition] = comboDescription;
    saveComboData();

    return message.channel.send(`✅ **${activeCharacterName}**의 콤보 **"${comboName}"**가 저장되었습니다.`);
}


// **🔹 !@콤보이름 형식으로 콤보 호출**
if (message.content.startsWith('!@')) {
  let match = message.content.match(/^!@\s*(["'\[].*?["'\]]|\S+)/);
  if (!match) return;

  let comboName = extractComboName(match[1]);
  let activeCharacterName = activeCharacter[message.author.id];

  if (!activeCharacterName) {
    return message.reply(`${message.author.tag}님, 활성화된 캐릭터가 없습니다. \`!지정 ["캐릭터 이름"]\` 명령어로 캐릭터를 지정해주세요.`);
  }

  if (!comboData[activeCharacterName] || !comboData[activeCharacterName][comboName]) {
    return message.channel.send(`${activeCharacterName}의 콤보 '${comboName}'를 찾을 수 없습니다.`);
  }

  let currentErosion = data[message.author.id][activeCharacterName]['침식률'] || 0;
  let availableCombos = comboData[activeCharacterName][comboName];

  // 침식률 조건에 맞는 콤보 찾기
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
    return message.channel.send(`> **${selectedCondition} 【${comboName}】**\n> ${selectedCombo}`);
  } else {
    return message.channel.send(`침식률 조건에 맞는 '${comboName}' 콤보를 찾을 수 없습니다.`);
  }
}

// !캐릭터삭제 명령어
if (message.content.startsWith('!캐릭터삭제')) {
    // 정규식으로 캐릭터 이름 파싱 ("" 또는 []로 감싸거나 일반 텍스트도 지원)
    const regex = /^!캐릭터삭제\s+(?:"([^"]+)"|\[([^\]]+)\]|(\S+))$/;
    const match = message.content.match(regex);

    if (!match) {
        return message.channel.send('❌ 사용법: `!캐릭터삭제 "캐릭터 이름"` 또는 `!캐릭터삭제 [캐릭터 이름]`');
    }

    // 따옴표 또는 대괄호를 제거하여 캐릭터 이름 추출
    const characterName = match[1] || match[2] || match[3];

    // 유저 데이터가 없거나 캐릭터 데이터가 없으면 오류 메시지 출력
    if (!data[message.author.id] || !data[message.author.id][characterName]) {
        return message.channel.send(`❌ **"${characterName}"** 캐릭터를 찾을 수 없습니다.`);
    }

    // 캐릭터 데이터 삭제
    delete data[message.author.id][characterName];

    // 해당 캐릭터의 콤보 데이터도 삭제
    if (comboData[characterName]) {
        delete comboData[characterName];
        saveComboData(); // 콤보 데이터 저장
    }

    // 활성 캐릭터가 삭제된 캐릭터라면 초기화
    if (activeCharacter[message.author.id] === characterName) {
        delete activeCharacter[message.author.id];
    }

    saveData(data); // 데이터 저장
    return message.channel.send(`✅ **"${characterName}"** 캐릭터가 삭제되었습니다.`);
}

// 로이스 이름을 "" 또는 []로 감싸면 공백 포함 가능
function extractLoisName(input) {
    let match = input.match(/^["'\[](.*?)["'\]]$/);
    return match ? match[1] : input;
}

// **🔹 !로이스 명령어 추가 (로이스 저장 기능)**
if (message.content.startsWith('!로이스 ')) {
    const regex = /^!로이스\s+(?:"([^"]+)"|\[([^\]]+)\]|(\S+))\s+(\S+)\s+(\S+)\s+(.+)$/;
    const match = message.content.match(regex);

    if (!match) {
        return message.channel.send('❌ 사용법: `!로이스 ["로이스 이름"] P감정 N감정 내용`\n📌 P감정에 `*`을 붙이면 메인 감정으로 설정됩니다.');
    }

    let loisName = match[1] || match[2] || match[3]; // 로이스 이름
    let pEmotion = match[4]; // P 감정
    let nEmotion = match[5]; // N 감정
    let loisDescription = match[6]; // 로이스 내용

    // P 감정 강조: '*'이 붙어있으면 【P: 감정】 형식으로 변환
    let mainPEmotion = pEmotion.includes('*') ? `【P: ${pEmotion.replace('*', '')}】` : `P: ${pEmotion}`;
    let formattedNEmotion = `N: ${nEmotion}`;

    let activeCharacterName = activeCharacter[message.author.id];
    if (!activeCharacterName) {
        return message.reply(`${message.author.tag}님, 활성화된 캐릭터가 없습니다. \`!지정 ["캐릭터 이름"]\` 명령어로 캐릭터를 지정해주세요.`);
    }

    if (!data[message.author.id][activeCharacterName]) {
        data[message.author.id][activeCharacterName] = {};
    }

    if (!data[message.author.id][activeCharacterName].lois) {
        data[message.author.id][activeCharacterName].lois = [];
    }

    // 로이스 저장
    data[message.author.id][activeCharacterName].lois.push({
        name: loisName,
        pEmotion: mainPEmotion,
        nEmotion: formattedNEmotion,
        description: loisDescription
    });

    saveData(data);
    return message.channel.send(`✅ **${activeCharacterName}**의 로이스 **"${loisName}"**가 등록되었습니다.\n> ${mainPEmotion} / ${formattedNEmotion}\n> ${loisDescription}`);
}

// **🔹 !로이스삭제 명령어 추가**
if (message.content.startsWith('!로이스삭제 ')) {
    const args = message.content.split(' ').slice(1);
    if (args.length < 1) {
        return message.channel.send('❌ 사용법: `!로이스삭제 ["로이스 이름"]`');
    }

    let loisName = extractLoisName(args.join(' ')); // 로이스 이름 추출
    let activeCharacterName = activeCharacter[message.author.id];

    if (!activeCharacterName) {
        return message.reply(`${message.author.tag}님, 활성화된 캐릭터가 없습니다. \`!지정 ["캐릭터 이름"]\` 명령어로 캐릭터를 지정해주세요.`);
    }

    if (!data[message.author.id][activeCharacterName] || !data[message.author.id][activeCharacterName].lois) {
        return message.channel.send(`❌ **${activeCharacterName}**에게 등록된 로이스가 없습니다.`);
    }

    let loisList = data[message.author.id][activeCharacterName].lois;
    let index = loisList.findIndex(lois => lois.name === loisName);

    if (index === -1) {
        return message.channel.send(`❌ **${activeCharacterName}**에게 **"${loisName}"** 로이스가 존재하지 않습니다.`);
    }

    // 로이스 삭제
    loisList.splice(index, 1);
    saveData(data);

    return message.channel.send(`🗑️ **${activeCharacterName}**의 로이스 **"${loisName}"**가 삭제되었습니다.`);
}

// **🔹 !타이터스 명령어 추가**
if (message.content.startsWith('!타이터스 ')) {
    const args = message.content.split(' ').slice(1);
    if (args.length < 1) {
        return message.channel.send('❌ 사용법: `!타이터스 ["로이스 이름"]`');
    }

    let loisName = extractLoisName(args.join(' '));
    let activeCharacterName = activeCharacter[message.author.id];

    if (!activeCharacterName) {
        return message.reply(`${message.author.tag}님, 활성화된 캐릭터가 없습니다. \`!지정 ["캐릭터 이름"]\` 명령어로 캐릭터를 지정해주세요.`);
    }

    if (!data[message.author.id][activeCharacterName] || !data[message.author.id][activeCharacterName].lois) {
        return message.channel.send(`❌ **${activeCharacterName}**에게 등록된 로이스가 없습니다.`);
    }

    let loisList = data[message.author.id][activeCharacterName].lois;
    let index = loisList.findIndex(lois => lois.name === loisName);

    if (index === -1) {
        return message.channel.send(`❌ **${activeCharacterName}**에게 **"${loisName}"** 로이스가 존재하지 않습니다.`);
    }

    // 침식률 상승 (타이터스로 변환할 때 +5 적용)
    data[message.author.id][activeCharacterName]['침식률'] = 
        (data[message.author.id][activeCharacterName]['침식률'] || 0) + 5;

    // 로이스 삭제
    loisList.splice(index, 1);
    saveData(data);

    return message.channel.send(`🔥 **${activeCharacterName}**의 로이스 **"${loisName}"**가 타이터스로 변환되었습니다!`);
}



});

// 봇 로그인
const { token } = require('./config.json');
client.login(token);
