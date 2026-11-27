/* 말해 YES OR NO — 1학년 문제 재료 (해부학: 근육 · 뼈대계)
 *
 *  출처: 구글 시트 "청암대학교 물리치료 공부방" → '근육이름 공부하기' 탭 · '뼈대계 공부하기' 탭 (2026-11-26 옮김)
 *  그림: 시트의 드라이브 링크에서 내려받아 img/muscle · img/bone 에 저장 (원본 주인 드라이브가 바뀌어도 그대로 보여요)
 *  문제는 게임이 이 재료로 매번 새로 만들어요 (이는곳 · 닿는곳 · 신경지배 · 작용 · 한글↔영어 · 그림 보고 맞히기).
 *  고치는 법: 아래 글자만 바꾸면 돼요. 등세모근 이는곳 중복 문구 삭제(2026-11-27). 오타 고친 것: 셋쨰→셋째, 원업침근→원엎침근, 앝은→얕은, 큰결정→큰결절, posteior→posterior
 */
window.YESNO_G1 = {
"muscles": [
{
"part": "얕은 등근육",
"ko": "등세모근",
"en": "trapezius",
"origin": "뒤통수뼈의 위목덜미선과 바깥뒤통수뼈융기, 목덜미인대, 일곱째목뼈와 모든 등뼈의 가시돌기",
"insert": "빗장뼈 가쪽 1/3, 어깨뼈봉우리, 어깨뼈가시",
"nerve": "더부신경, 셋째와 넷째 목신경",
"action": "어깨뼈 올림, 내림, 모음, 돌림",
"img": "img/muscle/m001.jpg"
},
{
"part": "얕은 등근육",
"ko": "어깨 올림근",
"en": "levator scapula",
"origin": "첫째~넷째목뼈의 가로돌기",
"insert": "어깨뼈의 위각과 어깨뼈가시 사이의 안쪽모서리",
"nerve": "어깨등신경",
"action": "어깨뼈 올림",
"img": "img/muscle/m002.jpg"
},
{
"part": "얕은 등근육",
"ko": "작은마름근",
"en": "rhomboid minor",
"origin": "목덜미인대, 일곱째목뼈와 첫째등뼈의 가시돌기",
"insert": "어깨뼈의 안쪽모서리 위쪽",
"nerve": "어깨등신경",
"action": "어깨뼈 모음과 올림",
"img": "img/muscle/m003.jpg"
},
{
"part": "얕은 등근육",
"ko": "큰마름근",
"en": "rhomboid major",
"origin": "둘째~다섯째등뼈의 가시돌기",
"insert": "어깨뼈의 가시와 아래각 사이의 안쪽모서리",
"nerve": "어깨등신경",
"action": "어깨뼈 모음과 올림",
"img": "img/muscle/m004.jpg"
},
{
"part": "얕은 등근육",
"ko": "넓은등근",
"en": "latissimus dorsi",
"origin": "일곱째~열두째등뼈와 모든 허리뼈의 가시돌기, 등허리근막, 엉덩뼈능선",
"insert": "위팔뼈의 결절사이고랑",
"nerve": "가슴등신경",
"action": "어깨뼈 폄, 모음, 안쪽 돌림",
"img": "img/muscle/m005.jpg"
},
{
"part": "얕은 가슴근육",
"ko": "큰가슴근",
"en": "pectoralis major",
"origin": "빗장뼈의 안쪽 1/2, 복장뼈, 첫째~여섯째 갈비연골, 배바깥빗근막",
"insert": "위팔뼈의 결절사이고랑",
"nerve": "안쪽·가쪽 가슴근신경",
"action": "위팔의 굽힘, 모음, 안쪽돌림",
"img": "img/muscle/m006.jpg"
},
{
"part": "얕은 가슴근육",
"ko": "작은가슴근",
"en": "pectoralis minor",
"origin": "셋째~다섯째 갈비뼈의 가쪽면",
"insert": "어깨뼈의 부리돌기",
"nerve": "안쪽가슴근신경",
"action": "어깨뼈를 앞쪽 아래로 당김",
"img": "img/muscle/m007.jpg"
},
{
"part": "얕은 가슴근육",
"ko": "앞톱니근",
"en": "serratus anterior",
"origin": "첫째~여덟째 갈비뼈의 가쪽면",
"insert": "어깨뼈의 안쪽모서리",
"nerve": "긴가슴신경",
"action": "어깨뼈의 내림(벌림)",
"img": "img/muscle/m008.jpg"
},
{
"part": "얕은 가슴근육",
"ko": "빗장밑근",
"en": "subclavius",
"origin": "첫째 갈비뼈와 갈비연골의 위모서리",
"insert": "빗장뼈의 아래모서리",
"nerve": "빗장밑신경",
"action": "빗장뼈를 밑으로 당김",
"img": "img/muscle/m009.jpg"
},
{
"part": "어깨의 근육",
"ko": "어깨세모근",
"en": "deltoid",
"origin": "빗장뼈의 가쪽 1/3, 어깨뼈봉우리, 어깨뼈가시",
"insert": "위팔뼈의 어깨세모근거친면",
"nerve": "겨드랑신경",
"action": "위팔의 굽힘, 폄, 벌림, 안쪽·가쪽돌림",
"img": "img/muscle/m010.jpg"
},
{
"part": "어깨의 근육",
"ko": "가시위근",
"en": "supraspinatus",
"origin": "어깨뼈의 가시위오목",
"insert": "위팔뼈의 큰결절의 윗면",
"nerve": "어깨위신경",
"action": "위팔의 벌림",
"img": "img/muscle/m011.jpg"
},
{
"part": "어깨의 근육",
"ko": "가시아래근",
"en": "infraspinatus",
"origin": "어깨뼈의 가시아래오목",
"insert": "위팔뼈의 큰결절의 윗면",
"nerve": "어깨위신경",
"action": "위팔의 가쪽돌림",
"img": "img/muscle/m012.jpg"
},
{
"part": "어깨의 근육",
"ko": "작은원근",
"en": "teres minor",
"origin": "어깨뼈의 가쪽모서리",
"insert": "위팔뼈의 큰결절의 가장 아랫면",
"nerve": "겨드랑신경",
"action": "위팔의 모음과 가쪽돌림",
"img": "img/muscle/m013.jpg"
},
{
"part": "어깨의 근육",
"ko": "큰원근",
"en": "teres major",
"origin": "어깨뼈의 아래각의 등쪽면",
"insert": "위팔뼈의 작은결절능선",
"nerve": "어깨밑신경",
"action": "위팔의 모음과 안쪽돌림",
"img": "img/muscle/m014.jpg"
},
{
"part": "어깨의 근육",
"ko": "어깨밑근",
"en": "subscapularis",
"origin": "어깨아래오목",
"insert": "위팔뼈의 작은결절",
"nerve": "어깨밑신경",
"action": "위팔의 안쪽돌림",
"img": "img/muscle/m015.jpg"
},
{
"part": "위팔의 근육",
"ko": "위팔두갈래근",
"en": "biceps brachii",
"origin": "긴갈래: 어깨뼈의 관절오목위결절, 짧은갈래: 어깨뼈의 부리돌기",
"insert": "노뼈의 거친면",
"nerve": "근육피부신경",
"action": "아래팔의 굽힘, 뒤침, 아래팔고정시 위팔의 굽힘",
"img": "img/muscle/m016.jpg"
},
{
"part": "위팔의 근육",
"ko": "위팔근",
"en": "brachialis",
"origin": "위팔뼈 앞면아래 2/3",
"insert": "자뼈의 갈고리돌기, 자뼈의 거친면",
"nerve": "근육피부신경",
"action": "아래팔의 굽힘",
"img": "img/muscle/m017.jpg"
},
{
"part": "위팔의 근육",
"ko": "부리위팔근",
"en": "coracobrachialis",
"origin": "어깨뼈의 부리돌기",
"insert": "위팔뼈의 안쪽모서리 중간부",
"nerve": "근육피부신경",
"action": "위팔의 굽힘과 모음",
"img": "img/muscle/m018.jpg"
},
{
"part": "위팔의 근육",
"ko": "위팔세갈래근",
"en": "triceps brachii",
"origin": "긴갈래: 어깨뼈의 관절 오목아래결절, 가쪽갈래: 위팔뼈의 뒷면 위가쪽, 안쪽갈래: 위팔뼈의 뒷면 아래안쪽",
"insert": "자뼈의 팔꿈치머리",
"nerve": "노신경",
"action": "아래팔의 폄, 위팔의 폄",
"img": "img/muscle/m019.jpg"
},
{
"part": "위팔의 근육",
"ko": "팔꿈치근",
"en": "anconeus",
"origin": "위팔뼈의 가쪽위관절융기",
"insert": "자뼈의 팔꿈치머리 가쪽",
"nerve": "노신경",
"action": "아래팔의 폄",
"img": "img/muscle/m020.jpg"
},
{
"part": "아래팔 앞칸 근육",
"ko": "원엎침근",
"en": "pronator teres",
"origin": "위팔뼈의 안쪽위관절융기, 자뼈의 갈고리돌기",
"insert": "노뼈중앙부 가쪽면",
"nerve": "정중신경",
"action": "아래팔의 엎침, 아래팔의 굽힘보조",
"img": "img/muscle/m021.jpg"
},
{
"part": "아래팔 앞칸 근육",
"ko": "노쪽손목굽힘근",
"en": "flexor carpi radialis",
"origin": "위팔뼈의 안쪽위관절융기",
"insert": "둘째와 셋째 손허리뼈의 바닥",
"nerve": "정중신경",
"action": "손목의 굽힘, 벌림(노쪽 치우침), 아래팔의 굽힘",
"img": "img/muscle/m022.jpg"
},
{
"part": "아래팔 앞칸 근육",
"ko": "긴손바닥근",
"en": "palmaris longus",
"origin": "위팔뼈의 안쪽위관절융기",
"insert": "손바닥널힘줄",
"nerve": "정중신경",
"action": "손목의 굽힘, 아래팔의 굽힘",
"img": "img/muscle/m023.jpg"
},
{
"part": "아래팔 앞칸 근육",
"ko": "자쪽손목굽힘근",
"en": "flexor carpi ulnaris",
"origin": "위팔뼈의 안쪽위관절융기, 자뼈의 팔꿈치머리의 뒷면",
"insert": "콩알뼈, 갈고리뼈 다섯째손허리뼈",
"nerve": "자신경",
"action": "손목의 굽힘·모음(자쪽 치우침), 아래팔의 굽힘",
"img": "img/muscle/m024.jpg"
},
{
"part": "아래팔 앞칸 근육",
"ko": "얕은손가락굽힘근",
"en": "flexor digitorum superficialis",
"origin": "위팔뼈의 안쪽위관절융기, 자뼈의 갈고리돌기, 노뼈의 앞모서리(빗선)",
"insert": "둘째-다섯째 손가락의 중간마디뼈 바닥",
"nerve": "정중신경",
"action": "둘째-다섯째손가락의 굽힘(PIP), 손목과 아래팔의 굽힘",
"img": "img/muscle/m025.jpg"
},
{
"part": "아래팔 앞칸 근육",
"ko": "깊은손가락굽힘근",
"en": "flexor digitorum profundus",
"origin": "자뼈의 앞면, 아래팔의 뼈사이막",
"insert": "둘째-다섯째 손가락의 끝마디뼈",
"nerve": "정중신경, 자신경",
"action": "둘째-다섯째손가락의 굽힘(PIP), 손목의 굽힘",
"img": "img/muscle/m026.jpg"
},
{
"part": "아래팔 앞칸 근육",
"ko": "긴엄지굽힘근",
"en": "flexor pollicis longus",
"origin": "노뼈의 앞면, 아래팔의 뼈사이막, 자뼈갈고리 돌기의 안쪽모서리",
"insert": "엄지끝마디뼈의 바닥",
"nerve": "정중신경",
"action": "엄지의 굽힘",
"img": "img/muscle/m027.jpg"
},
{
"part": "아래팔 앞칸 근육",
"ko": "네모엎침근",
"en": "pronator quadratus",
"origin": "자뼈의 먼쪽 1/4 앞면",
"insert": "노뼈의 먼쪽 1/4 앞면",
"nerve": "정중신경",
"action": "아래팔의 엎침",
"img": "img/muscle/m028.jpg"
},
{
"part": "아래팔 뒤칸 근육",
"ko": "위팔노근",
"en": "brachioradialis",
"origin": "위팔뼈의 가쪽위관절융기 위쪽",
"insert": "노뼈의 붓돌기",
"nerve": "노신경",
"action": "아래팔의 굽힘",
"img": "img/muscle/m029.jpg"
},
{
"part": "아래팔 뒤칸 근육",
"ko": "긴노쪽손목폄근",
"en": "extensor carpi radialis longus",
"origin": "위팔뼈의 가쪽위관절융기 위쪽",
"insert": "둘째손허리뼈의 바닥",
"nerve": "노신경",
"action": "손목의 폄과 벌림",
"img": "img/muscle/m030.jpg"
},
{
"part": "아래팔 뒤칸 근육",
"ko": "짧은 노쪽 손목폄근",
"en": "extensor carpi radialis brevis",
"origin": "위팔뼈의 가쪽위관절융기",
"insert": "셋째손허리뼈의 바닥",
"nerve": "노신경",
"action": "손목의 폄과 벌림",
"img": "img/muscle/m031.jpg"
},
{
"part": "아래팔 뒤칸 근육",
"ko": "손가락폄근",
"en": "extensor digitorum",
"origin": "위팔뼈의 가쪽위관절융기",
"insert": "둘째-넷째 중간 마디뼈와 끝마디뼈",
"nerve": "노신경",
"action": "둘째에서 넷째 손가락의 폄, 손목의 폄",
"img": "img/muscle/m032.jpg"
},
{
"part": "아래팔 뒤칸 근육",
"ko": "새끼폄근",
"en": "extensor digiti minimi",
"origin": "위팔뼈의 가쪽위관절융기",
"insert": "새끼손가락의 손가락폄근힘줄",
"nerve": "노신경",
"action": "새끼손가락의 폄",
"img": "img/muscle/m033.jpg"
},
{
"part": "아래팔 뒤칸 근육",
"ko": "자쪽손목폄근",
"en": "extensor carpi ulnaris",
"origin": "위팔뼈의 가쪽위관절융기",
"insert": "다섯째손허리뼈의 바닥",
"nerve": "노신경",
"action": "손목의 폄, 모음",
"img": "img/muscle/m034.jpg"
},
{
"part": "아래팔 뒤칸 근육",
"ko": "손뒤침근",
"en": "supinator",
"origin": "위팔뼈의 가쪽위관절융기, 자뼈 위쪽, 노뼈의 고리인대",
"insert": "노뼈 위쪽 1/3의 가쪽면과 앞면",
"nerve": "노신경",
"action": "아래팔의 뒤침",
"img": "img/muscle/m035.jpg"
},
{
"part": "아래팔 뒤칸 근육",
"ko": "긴엄지벌림근",
"en": "abductor pollicis longus",
"origin": "자뼈의 뒷면, 뼈사이막 노뼈의 뒷면",
"insert": "첫째손허리뼈의 바닥",
"nerve": "노신경",
"action": "엄지와 손목의 벌림",
"img": "img/muscle/m036.jpg"
},
{
"part": "아래팔 뒤칸 근육",
"ko": "짧은엄지폄근",
"en": "extensor pollicis brevis",
"origin": "노뼈의 뒷면, 뼈사이막",
"insert": "엄지첫마디뼈의 바닥",
"nerve": "노신경",
"action": "엄지첫마디뼈의 폄",
"img": "img/muscle/m037.jpg"
},
{
"part": "아래팔 뒤칸 근육",
"ko": "긴엄지폄근",
"en": "extensor pollicis longus",
"origin": "자뼈의 뒷면, 뼈사이막",
"insert": "엄지끝 마디뼈의 바닥",
"nerve": "노신경",
"action": "엄지첫마디뼈의 폄",
"img": "img/muscle/m038.jpg"
},
{
"part": "아래팔 뒤칸 근육",
"ko": "집게폄근",
"en": "extensor indicis",
"origin": "자뼈의 뒷면, 뼈사이막",
"insert": "둘째 손가락의 손가락폄근 힘줄",
"nerve": "노신경",
"action": "둘째손가락 첫마디뼈의 폄",
"img": "img/muscle/m039.jpg"
},
{
"part": "손의 고유근육",
"ko": "짧은엄지벌림근",
"en": "abductor pollicis brevis",
"origin": "굽힘근지지띠, 손배뼈, 큰마름뼈",
"insert": "엄지손가락의 첫마디 뼈바닥",
"nerve": "정중신경",
"action": "엄지손가락 벌림",
"img": "img/muscle/m040.jpg"
},
{
"part": "손의 고유근육",
"ko": "짧은엄지굽힘근",
"en": "flexor pollicis brevis",
"origin": "굽힘근지지띠, 큰마름뼈",
"insert": "엄지손가락의 첫마디 뼈바닥",
"nerve": "정중신경",
"action": "엄지손가락 첫마디뼈의 굽힘",
"img": "img/muscle/m041.jpg"
},
{
"part": "손의 고유근육",
"ko": "엄지맞섬근",
"en": "opponens pollicis",
"origin": "굽힘근지지띠, 큰마름뼈",
"insert": "첫째손허리뼈 가쪽면",
"nerve": "정중신경",
"action": "엄지손가락의 새끼손가락쪽으로 당김(맞섬)",
"img": "img/muscle/m042.jpg"
},
{
"part": "손의 고유근육",
"ko": "엄지모음근",
"en": "adductor pollicis",
"origin": "빗갈래: 큰·작은 마름뼈, 알머리뼈, 둘째와 셋째손허리뼈 바닥 가로갈래: 셋째손허리뼈",
"insert": "엄지손가락의 첫마디 뼈바닥",
"nerve": "자신경",
"action": "엄지손가락 모음, 엄지손가락 맞섬",
"img": "img/muscle/m043.jpg"
},
{
"part": "손의 고유근육",
"ko": "새끼벌림근",
"en": "abductor digiti minimi",
"origin": "굽힘근지지띠, 콩알뼈",
"insert": "다섯째손가락의 첫마디뼈 안쪽",
"nerve": "자신경",
"action": "새끼손가락의 벌림",
"img": "img/muscle/m044.jpg"
},
{
"part": "손의 고유근육",
"ko": "짧은새끼굽힘근",
"en": "flexor digiti minimi brevis",
"origin": "굽힘근지지띠, 갈고리뼈",
"insert": "다섯째손가락의 첫마디뼈 안쪽",
"nerve": "자신경",
"action": "새끼손가락의 첫마디뼈 굽힘",
"img": "img/muscle/m045.jpg"
},
{
"part": "손의 고유근육",
"ko": "새끼맞섬근",
"en": "opponens digiti minimi",
"origin": "굽힘근지지띠, 갈고리뼈",
"insert": "다섯째손허리뼈의 안쪽모서리",
"nerve": "자신경",
"action": "새끼손가락을 엄지쪽으로 당김(맞섬)",
"img": "img/muscle/m046.jpg"
},
{
"part": "손의 고유근육",
"ko": "벌레근",
"en": "lumbricales",
"origin": "깊은손가락굽힘근힘줄",
"insert": "손가락폄근의 힘줄, 둘째-다섯째 손가락 첫마디뼈바닥",
"nerve": "첫째와 둘째근 : 정중신경, 셋째와 넷째근 : 자신경",
"action": "둘째-다섯째 손가락의 첫마디 뼈의 굽힘, 중간마디뼈 및 끝마디뼈의 폄",
"img": "img/muscle/m047.jpg"
},
{
"part": "손의 고유근육",
"ko": "바닥쪽뼈사이근",
"en": "palmar interosseous",
"origin": "둘째손허리뼈 안쪽, 넷째와 다섯째 손허리뼈 가쪽",
"insert": "둘째손가락의 첫마디 뼈안쪽, 넷째와 다섯째 손가락의 첫마디뼈 바깥쪽",
"nerve": "자신경",
"action": "셋째손가락을 기준으로 모음",
"img": "img/muscle/m048.jpg"
},
{
"part": "손의 고유근육",
"ko": "등쪽뼈사이근",
"en": "dorsal interosseous",
"origin": "모든 손허리뼈의 마주보는 면",
"insert": "둘째와 셋째손가락의 첫마디뼈 바깥쪽 셋째와 넷째손가락의 첫마디뼈 안쪽",
"nerve": "자신경",
"action": "셋째손가락을 기준으로 벌림",
"img": "img/muscle/m049.jpg"
},
{
"part": "골반 안쪽 근육",
"ko": "큰허리근",
"en": "psoas major",
"origin": "허리뼈의 가로돌기, 허리뼈몸통, 척추사이원반의 앞면",
"insert": "엉덩허리근힘줄을 거쳐 넙다리뼈의 작은돌기",
"nerve": "둘째~셋째 허리신경, 넙다리신경",
"action": "넓적다리의 굽힘, 다리고정 시 척주의 굽힘",
"img": "img/muscle/m050.jpg"
},
{
"part": "골반 안쪽 근육",
"ko": "작은허리근",
"en": "psoas minor",
"origin": "열두째등뼈, 첫째허리뼈의 척추몸통과 척추사이원반 가쪽면",
"insert": "두덩뼈빗, 엉덩두덩융기",
"nerve": "첫째~둘째 허리신경",
"action": "큰허리근을 도와 척주를 굽힘",
"img": "img/muscle/m051.jpg"
},
{
"part": "골반 안쪽 근육",
"ko": "엉덩근",
"en": "iliacus",
"origin": "엉덩뼈오목 윗부분 2/3, 엉덩뼈능선",
"insert": "엉덩허리근힘줄을 거쳐 넙다리뼈의 작은돌기",
"nerve": "넙다리신경",
"action": "넓적다리의 굽힘",
"img": "img/muscle/m052.jpg"
},
{
"part": "골반 가쪽 근육",
"ko": "큰볼기근",
"en": "gluteus maximus",
"origin": "엉덩뼈능선의 뒷면, 뒤볼기근선, 엉치뼈와 꼬리뼈의 뒷면, 엉치결절",
"insert": "넙다리뼈의 볼기근 거친면, 엉덩정강띠",
"nerve": "아래볼기신경",
"action": "넓적다리의 폄, 넓적 다리의 벌림과 가쪽돌림",
"img": "img/muscle/m053.jpg"
},
{
"part": "골반 가쪽 근육",
"ko": "중간볼기근",
"en": "gluteus medius",
"origin": "위는 뒤볼기근선, 아래는 엉덩뼈가쪽면",
"insert": "넙다리뼈의 큰돌기",
"nerve": "위볼기신경",
"action": "넓적다리의 벌림, 다리폄시 넓적다리의 안쪽돌림",
"img": "img/muscle/m054.jpg"
},
{
"part": "골반 가쪽 근육",
"ko": "작은볼기근",
"en": "gluteus minimus",
"origin": "엉덩뼈 아래볼기근선, 큰궁둥패임 모서리",
"insert": "넙다리뼈의 큰돌기",
"nerve": "위볼기신경",
"action": "넓적다리의 벌림, 다리폄 시 넓적다리의 안쪽돌림",
"img": "img/muscle/m055.jpg"
},
{
"part": "골반 가쪽 근육",
"ko": "넙다리근막긴장근",
"en": "tensor fasciae latae",
"origin": "엉덩뼈능선의 앞모서리",
"insert": "엉덩정강띠 (넓적다리의 중간부 1/3)",
"nerve": "위볼기신경",
"action": "넓적다리의 굽힘, 벌림, 안쪽돌림",
"img": "img/muscle/m056.jpg"
},
{
"part": "골반 가쪽 근육",
"ko": "궁둥구멍근",
"en": "piriformis",
"origin": "엉치뼈 앞면, 엉치결절인대",
"insert": "넙다리뼈의 큰돌기 위모서리",
"nerve": "첫째와 둘째 엉치신경",
"action": "넓적다리의 가쪽돌림, 넓적다리의 굽힘시 넓적다리의 벌림",
"img": "img/muscle/m057.jpg"
},
{
"part": "골반 가쪽 근육",
"ko": "속폐쇄근",
"en": "obturator internus",
"origin": "폐쇄구멍 안쪽주변, 폐쇄막",
"insert": "넙다리뼈의 큰돌기 위모서리 안쪽면",
"nerve": "속폐쇄신경",
"action": "넓적다리의 가쪽 돌림, 넓적다리의 굽힘시 넓적다리의 벌림",
"img": "img/muscle/m058.jpg"
},
{
"part": "골반 가쪽 근육",
"ko": "바깥폐쇄근",
"en": "obturator externus",
"origin": "폐쇄구멍 가쪽주변, 폐쇄막",
"insert": "넙다리뼈의 큰돌기",
"nerve": "폐쇄신경",
"action": "넓적다리의 모음, 가쪽돌림",
"img": "img/muscle/m059.jpg"
},
{
"part": "골반 가쪽 근육",
"ko": "위쌍둥이근",
"en": "superior gemellus",
"origin": "궁둥뼈가시 가쪽",
"insert": "넙다리뼈의 큰돌기 위모서리 안쪽면",
"nerve": "속폐쇄신경",
"action": "넓적다리의 가쪽돌림",
"img": "img/muscle/m060.jpg"
},
{
"part": "골반 가쪽 근육",
"ko": "아래쌍둥이근",
"en": "inferior gemellus",
"origin": "궁둥뼈거친면 위쪽",
"insert": "넙다리뼈의 큰돌기 위모서리 안쪽면",
"nerve": "넙다리 네모근신경",
"action": "넓적다리의 가쪽돌림",
"img": "img/muscle/m061.jpg"
},
{
"part": "골반 가쪽 근육",
"ko": "넙다리네모근",
"en": "quadratus femoris",
"origin": "궁둥뼈거친면 가쪽",
"insert": "넙다리뼈의 큰돌기 돌기사이능선",
"nerve": "넙다리 네모근신경",
"action": "넓적다리의 모음, 가쪽돌림",
"img": "img/muscle/m062.jpg"
},
{
"part": "넙다리 근육",
"ko": "두덩근",
"en": "pectineus",
"origin": "두덩뼈빗, 엉덩두덩융기와 두덩결절 사이 두덩뼈표면",
"insert": "넙다리뼈의 작은돌기와 거친선 사이",
"nerve": "넙다리신경",
"action": "넓적다리의 굽힘, 모음, 안쪽돌림",
"img": "img/muscle/m063.jpg"
},
{
"part": "넙다리 근육",
"ko": "긴모음근",
"en": "adductor longus",
"origin": "두덩결합 앞면",
"insert": "넙다리뼈의 거친선 중간부",
"nerve": "폐쇄신경",
"action": "넓적다리의 모음, 굽힘, 안쪽돌림",
"img": "img/muscle/m064.jpg"
},
{
"part": "넙다리 근육",
"ko": "짧은모음근",
"en": "adductor brevis",
"origin": "두덩뼈아래가지 가쪽면",
"insert": "넙다리뼈의 거친선 중간부",
"nerve": "폐쇄신경",
"action": "넓적다리의 모음, 굽힘",
"img": "img/muscle/m065.jpg"
},
{
"part": "넙다리 근육",
"ko": "큰모음근",
"en": "adductor magnus",
"origin": "궁둥뼈가지, 궁둥뼈 거친면, 두덩뼈가지",
"insert": "거친선, 모음근결절",
"nerve": "폐쇄신경, 궁둥신경",
"action": "넓적다리의 모음, 굽힘, 폄",
"img": "img/muscle/m066.jpg"
},
{
"part": "넙다리 근육",
"ko": "두덩정강근",
"en": "gracilis",
"origin": "두덩결합, 두덩뼈 아래가지",
"insert": "정강뼈의 위안쪽면",
"nerve": "폐쇄신경",
"action": "넓적다리의 모음",
"img": "img/muscle/m067.jpg"
},
{
"part": "넙다리 근육",
"ko": "넙다리빗근",
"en": "sartorius",
"origin": "위앞엉덩뼈가시",
"insert": "정강뼈의 위안쪽면",
"nerve": "넙다리신경",
"action": "종아리의 굽힘, 넓적다리의 가쪽돌림, 벌림, 굽힘",
"img": "img/muscle/m068.jpg"
},
{
"part": "넙다리 근육",
"ko": "넙다리곧은근",
"en": "rectus femoris",
"origin": "아래앞엉덩뼈가시 볼기뼈절구",
"insert": "무릎뼈바닥, 무릎인대로 되어 정강뼈거친면에 닿음",
"nerve": "넙다리신경",
"action": "종아리의 폄, 넓적다리의 굽힘",
"img": "img/muscle/m069.jpg"
},
{
"part": "넙다리 근육",
"ko": "안쪽넓은근",
"en": "vastus medialis",
"origin": "넙다리뼈의 돌기 사이선 아래, 거친선",
"insert": "무릎뼈바닥, 무릎인대로 되어 정강뼈거친면에 닿음",
"nerve": "넙다리신경",
"action": "종아리의 폄",
"img": "img/muscle/m070.jpg"
},
{
"part": "넙다리 근육",
"ko": "중간넓은근",
"en": "vastus intermedius",
"origin": "넙다리뼈몸통 앞면 위",
"insert": "무릎뼈바닥, 무릎인대로 되어 정강뼈거친면에 닿음",
"nerve": "넙다리신경",
"action": "종아리의 폄",
"img": "img/muscle/m071.jpg"
},
{
"part": "넙다리 근육",
"ko": "가쪽넓은근",
"en": "vastus lateralis",
"origin": "돌기사이선, 큰돌기, 거친선",
"insert": "무릎뼈바닥, 무릎인대로 되어 정강뼈거친면에 닿음",
"nerve": "넙다리신경",
"action": "종아리의 폄",
"img": "img/muscle/m072.jpg"
},
{
"part": "넙다리 근육",
"ko": "넙다리두갈래근",
"en": "biceps femoris",
"origin": "긴갈래 : 궁둥뼈거친면, 짧은갈래 : 넙다리뼈 거친선",
"insert": "종아리뼈머리, 정강뼈의 가쪽 관절융기",
"nerve": "궁둥신경",
"action": "종아리의 굽힘, 넓적다리의 폄(무릎관절 반굽힘 시)",
"img": "img/muscle/m073.jpg"
},
{
"part": "넙다리 근육",
"ko": "반힘줄근",
"en": "semitendinosus",
"origin": "궁둥뼈거친면",
"insert": "정강뼈의 위안쪽면",
"nerve": "궁둥신경",
"action": "종아리의 가쪽돌림, 종아리의 굽힘, 넓적다리의 폄, 무릎관절 반굽힘 시 종아리의 안쪽돌림",
"img": "img/muscle/m074.jpg"
},
{
"part": "넙다리 근육",
"ko": "반막근",
"en": "semimembranosus",
"origin": "궁둥뼈거친면",
"insert": "정강뼈의 안쪽관절융기 안쪽 뒤면",
"nerve": "궁둥신경",
"action": "종아리의 굽힘, 넓적다리의 폄, 무릎관절 반굽힘 시 종아리의 안쪽돌림",
"img": "img/muscle/m075.jpg"
},
{
"part": "종아리 근육",
"ko": "앞정강근",
"en": "tibialis anterior",
"origin": "정강뼈의 가쪽관절융기, 정강뼈몸통 위 2/3, 뼈사이막",
"insert": "안쪽쐐기뼈 먼쪽, 첫째발허리뼈의 바닥",
"nerve": "깊은종아리신경",
"action": "발의 박등굽힘, 안쪽번짐(내번)",
"img": "img/muscle/m076.jpg"
},
{
"part": "종아리 근육",
"ko": "긴발가락폄근",
"en": "extensor digitorum longus",
"origin": "정강뼈의 가쪽관절융기, 종아리뼈 위 3/4 앞면, 뼈사이막",
"insert": "둘째~다섯째 발가락의 발허리뼈와 끝마디뼈의 등쪽면",
"nerve": "깊은종아리신경",
"action": "둘째~다섯째 발가락의 폄, 둘째~다섯째발가락의 폄시 발의 발등굽힘",
"img": "img/muscle/m077.jpg"
},
{
"part": "종아리 근육",
"ko": "긴엄지폄근",
"en": "extensor hallucis longus",
"origin": "종아리뼈의 중간부 앞면, 뼈사이막",
"insert": "엄지끝마디뼈의 바닥",
"nerve": "깊은종아리신경",
"action": "엄지의 폄, 엄지의 폄 시 발의 발등굽힘",
"img": "img/muscle/m078.jpg"
},
{
"part": "종아리 근육",
"ko": "셋째종아리근",
"en": "peroneus tertius",
"origin": "종아리뼈의 아래 앞면",
"insert": "다섯째발허리뼈 바닥의 등쪽면",
"nerve": "깊은종아리신경",
"action": "발의 발등굽힘, 가쪽번짐(외번)",
"img": "img/muscle/m079.jpg"
},
{
"part": "종아리 근육",
"ko": "긴종아리근",
"en": "peroneus longus",
"origin": "정강뼈의 가쪽관절융기, 종아리뼈머리와 종아리뼈 위 가쪽면 2/3",
"insert": "안쪽쐐기뼈 가쪽, 첫째발허리뼈의 바닥",
"nerve": "얕은종아리신경",
"action": "발의 발바닥굽힘, 가쪽번짐",
"img": "img/muscle/m080.jpg"
},
{
"part": "종아리 근육",
"ko": "짧은종아리근",
"en": "peroneus brevis",
"origin": "종아리뼈의 아래 가쪽면 2/3",
"insert": "다섯째발허리뼈 바닥의 가쪽",
"nerve": "얕은종아리신경",
"action": "발의 발바닥굽힘, 가쪽번짐",
"img": "img/muscle/m081.jpg"
},
{
"part": "종아리 근육",
"ko": "장딴지근",
"en": "gastrocnemius",
"origin": "안쪽갈래 : 넙다리뼈의 안쪽위관절융기, 가쪽갈래 : 넙다리뼈의 가쪽위관절융기",
"insert": "발꿈치힘줄을 경유하여 발꿈치뼈 융기에 닿음",
"nerve": "정강신경",
"action": "발의 발바닥굽힘, 종아리의 굽힘",
"img": "img/muscle/m082.jpg"
},
{
"part": "종아리 근육",
"ko": "가자미근",
"en": "soleus",
"origin": "종아리뼈 뒷면, 종아리뼈 몸통 위 1/3, 정강뼈의 중간부 안쪽모서리",
"insert": "발꿈치힘줄을 경유하여 발꿈치뼈 융기에 닿음",
"nerve": "정강신경",
"action": "발의 발바닥굽힘, 종아리의 고정",
"img": "img/muscle/m083.jpg"
},
{
"part": "종아리 근육",
"ko": "장딴지빗근",
"en": "plantaris",
"origin": "넙다리뼈의 가쪽위관절융기선",
"insert": "발꿈치뼈의 뒤안쪽",
"nerve": "정강신경",
"action": "발의 발바닥굽힘",
"img": "img/muscle/m084.jpg"
},
{
"part": "종아리 근육",
"ko": "오금근",
"en": "popliteus",
"origin": "넙다리뼈의 가쪽위관절융기",
"insert": "정강뼈의 윗부분 1/4",
"nerve": "정강신경",
"action": "종아리의 굽힘, 종아리의 굽힘 시 종아리의 안쪽돌림",
"img": "img/muscle/m085.jpg"
},
{
"part": "종아리 근육",
"ko": "긴발가락굽힘근",
"en": "flexor digitorum longus",
"origin": "정강뼈의 몸통 중간부 뒷면바닥",
"insert": "둘째~다섯째 발가락의 끝마디뼈",
"nerve": "정강신경",
"action": "둘째~다섯째발가락의 굽힘, 발의 발바닥굽힘",
"img": "img/muscle/m086.jpg"
},
{
"part": "종아리 근육",
"ko": "긴엄지굽힘근",
"en": "flexor hallucis longus",
"origin": "종아리뼈의 아래 뒷면 2/3, 뼈사이막",
"insert": "엄지발가락의 끝마디뼈바닥",
"nerve": "정강신경",
"action": "엄지의 굽힘, 발의 발바닥굽힘",
"img": "img/muscle/m087.jpg"
},
{
"part": "종아리 근육",
"ko": "뒤정강근",
"en": "tibialis posterior",
"origin": "정강뼈의 뒤가쪽, 종아리뼈의 위안쪽면 2/3, 뼈사이막",
"insert": "발배뼈, 쐐기뼈(3개), 입방뼈, 둘째~넷째발허리뼈바닥",
"nerve": "정강신경",
"action": "발의 발바닥굽힘, 안쪽번짐",
"img": "img/muscle/m088.jpg"
},
{
"part": "발의 근육",
"ko": "짧은엄지폄근",
"en": "extensor hallucis brevis",
"origin": "발꿈치뼈 등쪽의 앞부분",
"insert": "엄지발가락의 첫마디뼈 바닥 등쪽",
"nerve": "깊은종아리신경",
"action": "엄지발가락의 폄",
"img": "img/muscle/m089.jpg"
},
{
"part": "발의 근육",
"ko": "짧은발가락폄근",
"en": "extensor digitorum brevis",
"origin": "발꿈치뼈 등쪽의 앞부분",
"insert": "둘째~넷째발가락의 첫마디뼈 바닥 등쪽",
"nerve": "깊은종아리신경",
"action": "둘째~넷째 발가락의 폄",
"img": "img/muscle/m090.jpg"
},
{
"part": "발의 근육",
"ko": "엄지벌림근",
"en": "abductor hallucis",
"origin": "발꿈치뼈의 안쪽돌기, 발바닥널힘줄",
"insert": "엄지발가락의 첫마디뼈 바닥의 안쪽",
"nerve": "안쪽발바닥신경",
"action": "엄지발가락의 벌림",
"img": "img/muscle/m091.jpg"
},
{
"part": "발의 근육",
"ko": "짧은발가락굽힘근",
"en": "flexor digitorum brevis",
"origin": "발꿈치뼈의 안쪽돌기, 발바닥널힘줄",
"insert": "둘째~다섯째 발가락의 중간마디뼈 바닥",
"nerve": "안쪽발바닥신경",
"action": "둘째~다섯째 발가락의 굽힘",
"img": "img/muscle/m092.jpg"
},
{
"part": "발의 근육",
"ko": "새끼벌림근",
"en": "abductor digiti minimi",
"origin": "발꿈치뼈의 가쪽돌기와 안쪽돌기",
"insert": "새끼발가락 첫마디뼈바닥의 가쪽",
"nerve": "가쪽발바닥신경",
"action": "새끼발가락의 벌림, 굽힘보조",
"img": "img/muscle/m093.jpg"
},
{
"part": "발의 근육",
"ko": "발바닥네모근",
"en": "quadratus plantae",
"origin": "안쪽갈래 : 발꿈치뼈의 안쪽면, 가쪽갈래 : 발꿈치뼈의 바닥면의 가쪽모서리",
"insert": "긴발가락굽힘근의 힘줄",
"nerve": "가쪽발바닥신경",
"action": "둘째~다섯째 발가락 끝마디뼈의 굽힘",
"img": "img/muscle/m094.jpg"
},
{
"part": "발의 근육",
"ko": "벌레근",
"en": "lumbricales",
"origin": "긴발가락굽힘근의 힘줄",
"insert": "둘째~다섯째 발가락의 끝마디 뼈바닥",
"nerve": "안쪽·가쪽 발바닥신경",
"action": "둘째~다섯째발가락의 MP 관절의 굽힘, IP 관절의 폄",
"img": "img/muscle/m095.jpg"
},
{
"part": "발의 근육",
"ko": "짧은엄지굽힘근",
"en": "flexor hallucis brevis",
"origin": "입방뼈 바닥면 안쪽, 가쪽쐐기뼈",
"insert": "엄지발가락의 첫마디뼈 안쪽과 가쪽",
"nerve": "안쪽발바닥신경",
"action": "엄지발가락의 굽힘",
"img": "img/muscle/m096.jpg"
},
{
"part": "발의 근육",
"ko": "엄지모음근",
"en": "adductor hallucis",
"origin": "빗갈래 : 둘째~넷째 발허리뼈의 바닥부, 가로갈래 : 둘째~다섯째 MP 관절주머니",
"insert": "엄지발가락의 첫마디뼈 바닥의 가쪽",
"nerve": "가쪽발바닥신경",
"action": "엄지발가락의 모음, 굽힘보조",
"img": "img/muscle/m097.jpg"
},
{
"part": "발의 근육",
"ko": "짧은새끼굽힘근",
"en": "flexor digiti minimi brevis",
"origin": "다섯째발허리뼈의 바닥",
"insert": "새끼발가락 첫마디뼈 바닥의 가쪽",
"nerve": "가쪽발바닥신경",
"action": "새끼발가락의 굽힘",
"img": "img/muscle/m098.jpg"
},
{
"part": "발의 근육",
"ko": "등쪽뼈사이근",
"en": "dorsal interosseous",
"origin": "발허리뼈의 인접한 가쪽",
"insert": "둘째발가락 첫마디뼈의 안쪽, 둘째~넷째 발가락 첫마디뼈의 가쪽",
"nerve": "가쪽발바닥신경",
"action": "둘째발가락을 중심으로 둘째~넷째 발가락의 벌림, 첫마디뼈굽힘과 중간마디뼈·끝마디뼈의 폄보조",
"img": "img/muscle/m099.jpg"
},
{
"part": "발의 근육",
"ko": "바닥쪽뼈사이근",
"en": "plantar interosseous",
"origin": "셋째~다섯째 발허리뼈 바닥의 안쪽면",
"insert": "셋째~다섯째 발가락 첫마디뼈의 안쪽면과 바닥",
"nerve": "가쪽발바닥신경",
"action": "둘째발가락을 중심으로 둘째~넷째 발가락의 모음, 첫마디뼈굽힘과 중간마디뼈·끝마디뼈의 폄보조",
"img": "img/muscle/m100.jpg"
}
],
"bones": [
{
"ch": "척주뼈",
"img": "img/bone/b01.jpg",
"items": [
{
"n": 1,
"ko": "목굽이",
"en": "cervical curve"
},
{
"n": 2,
"ko": "등굽이",
"en": "thoracic curve"
},
{
"n": 3,
"ko": "허리굽이",
"en": "lumbar curve"
},
{
"n": 4,
"ko": "엉치굽이",
"en": "sacral curve"
},
{
"n": 5,
"ko": "목뼈",
"en": "cervical vertebrae"
},
{
"n": 6,
"ko": "등뼈",
"en": "thoracic vertebrae"
},
{
"n": 7,
"ko": "허리뼈",
"en": "lumbar vertebrae"
},
{
"n": 8,
"ko": "고리뼈",
"en": "atlas"
},
{
"n": 9,
"ko": "중쇠뼈",
"en": "axis"
},
{
"n": 10,
"ko": "척추사이원반",
"en": "intervertebral disc"
},
{
"n": 11,
"ko": "척추사이구멍",
"en": "intervertebral foramen"
},
{
"n": 12,
"ko": "엉치뼈",
"en": "sacrum"
},
{
"n": 13,
"ko": "꼬리뼈",
"en": "coccyx"
}
]
},
{
"ch": "척추뼈의 일반구조",
"img": "img/bone/b02.jpg",
"items": [
{
"n": 1,
"ko": "가시돌기",
"en": "spinous process"
},
{
"n": 2,
"ko": "고리판",
"en": "lamina"
},
{
"n": 3,
"ko": "가로돌기",
"en": "transverse process"
},
{
"n": 4,
"ko": "위관절돌기",
"en": "superior articular process"
},
{
"n": 5,
"ko": "고리뿌리",
"en": "pedicle"
},
{
"n": 6,
"ko": "척추뼈몸통",
"en": "vertebral body"
},
{
"n": 7,
"ko": "척추뼈구멍",
"en": "vertebral foramen"
},
{
"n": 8,
"ko": "척추뼈고리",
"en": "vertebral arch"
}
]
},
{
"ch": "고리뼈",
"img": "img/bone/b03.jpg",
"items": [
{
"n": 1,
"ko": "앞고리",
"en": "anterior arch"
},
{
"n": 2,
"ko": "치아돌기오목",
"en": "facet for dens"
},
{
"n": 3,
"ko": "위관절면",
"en": "superior articular surface"
},
{
"n": 4,
"ko": "가로구멍",
"en": "transverse foramen"
},
{
"n": 5,
"ko": "가로돌기",
"en": "transverse process"
},
{
"n": 6,
"ko": "척추동맥고랑",
"en": "groove for vertebral a."
},
{
"n": 7,
"ko": "뒤결절",
"en": "posterior tubercle"
},
{
"n": 8,
"ko": "뒤고리",
"en": "posterior arch"
},
{
"n": 9,
"ko": "척추뼈구멍",
"en": "vertebral foramen"
},
{
"n": 10,
"ko": "가쪽덩이",
"en": "lateral mass"
},
{
"n": 11,
"ko": "앞결절",
"en": "anterior tubercle"
}
]
},
{
"ch": "중쇠뼈",
"img": "img/bone/b04.jpg",
"items": [
{
"n": 1,
"ko": "치아돌기",
"en": "dens"
},
{
"n": 2,
"ko": "위관절면",
"en": "superior articular surface"
},
{
"n": 3,
"ko": "가로돌기",
"en": "transverse process"
},
{
"n": 4,
"ko": "가로구멍",
"en": "transverse foramen"
},
{
"n": 5,
"ko": "가시돌기",
"en": "spinous process"
},
{
"n": 6,
"ko": "앞관절면",
"en": "anterior articular facet"
},
{
"n": 7,
"ko": "뒤관절면",
"en": "posterior articular facet"
},
{
"n": 8,
"ko": "아래관절돌기",
"en": "inferior articular process"
}
]
},
{
"ch": "등뼈",
"img": "img/bone/b05.jpg",
"items": [
{
"n": 1,
"ko": "척추뼈몸통",
"en": "vertebral body"
},
{
"n": 2,
"ko": "위갈비오목",
"en": "superior costal facet"
},
{
"n": 3,
"ko": "고리판",
"en": "lamina"
},
{
"n": 4,
"ko": "가시돌기",
"en": "spinous process"
},
{
"n": 5,
"ko": "위관절돌기",
"en": "superior articular process"
},
{
"n": 6,
"ko": "가로돌기",
"en": "transverse process"
},
{
"n": 7,
"ko": "가로갈비오목",
"en": "transverse costal facet"
},
{
"n": 8,
"ko": "고리뿌리",
"en": "pedicle"
},
{
"n": 9,
"ko": "아래관절돌기",
"en": "inferior articular process"
},
{
"n": 10,
"ko": "아래척추뼈패임",
"en": "inferior vertebral notch"
},
{
"n": 11,
"ko": "아래갈비오목",
"en": "inferior costal facet"
}
]
},
{
"ch": "허리뼈",
"img": "img/bone/b06.jpg",
"items": [
{
"n": 1,
"ko": "가시돌기",
"en": "spinous process"
},
{
"n": 2,
"ko": "가로돌기",
"en": "transverse process"
},
{
"n": 3,
"ko": "위관절면",
"en": "superior articular surface"
},
{
"n": 4,
"ko": "허리뼈몸통",
"en": "lumbar vertebral body"
},
{
"n": 5,
"ko": "척추뼈구멍",
"en": "vertebral foramen"
},
{
"n": 6,
"ko": "덧돌기",
"en": "accessory process"
},
{
"n": 7,
"ko": "꼭지돌기",
"en": "malmillary process"
},
{
"n": 8,
"ko": "아래관절돌기",
"en": "inferior articular process"
},
{
"n": 9,
"ko": "아래관절면",
"en": "inferior articular facet"
},
{
"n": 10,
"ko": "위관절돌기",
"en": "superior articular process"
}
]
},
{
"ch": "엉치뼈와 꼬리뼈",
"img": "img/bone/b07.jpg",
"items": [
{
"n": 1,
"ko": "엉치뼈바닥",
"en": "base of sacrum"
},
{
"n": 2,
"ko": "엉치뼈날개",
"en": "ala of sacrum"
},
{
"n": 3,
"ko": "가로선",
"en": "transverse line"
},
{
"n": 4,
"ko": "앞엉치뼈구멍",
"en": "anterior sacral foramen"
},
{
"n": 5,
"ko": "꼬리뼈",
"en": "coccyx"
},
{
"n": 6,
"ko": "엉치뼈곶",
"en": "promontory of sacrum"
},
{
"n": 7,
"ko": "첫째엉치뼈몸통",
"en": "body of 1st sacrum"
},
{
"n": 8,
"ko": "위관절돌기",
"en": "superior articular process"
},
{
"n": 9,
"ko": "엉치뼈관",
"en": "sacral canal"
},
{
"n": 10,
"ko": "중간엉치뼈능선",
"en": "intermediate sacral crest"
},
{
"n": 11,
"ko": "가쪽엉치뼈능선",
"en": "lateral sacral crest"
},
{
"n": 12,
"ko": "귓바퀴면",
"en": "auricular surface"
},
{
"n": 13,
"ko": "정중엉치뼈능선",
"en": "median sacral crest"
},
{
"n": 14,
"ko": "뒤엉치뼈구멍",
"en": "posterior sacral foramen"
},
{
"n": 15,
"ko": "엉치뼈틈새",
"en": "sacral hiatus"
},
{
"n": 16,
"ko": "엉치뼈뿔",
"en": "sacral cornu"
}
]
},
{
"ch": "어깨뼈",
"img": "img/bone/b08.jpg",
"items": [
{
"n": 1,
"ko": "위각",
"en": "superior angle"
},
{
"n": 2,
"ko": "위모서리",
"en": "superior border"
},
{
"n": 3,
"ko": "가시위오목",
"en": "supraspinous fossa"
},
{
"n": 4,
"ko": "가시아래오목",
"en": "infraspinous fossa"
},
{
"n": 5,
"ko": "안쪽모서리",
"en": "medial border"
},
{
"n": 6,
"ko": "봉우리",
"en": "acromion"
},
{
"n": 7,
"ko": "부리돌기",
"en": "coracoid process"
},
{
"n": 8,
"ko": "어깨뼈가시",
"en": "scapular spine"
},
{
"n": 9,
"ko": "접시오목",
"en": "glenoid cavity"
},
{
"n": 10,
"ko": "가쪽모서리",
"en": "lateral border"
},
{
"n": 11,
"ko": "아래각",
"en": "inferior angle"
},
{
"n": 12,
"ko": "접시위결절",
"en": "supraglenoid tubercle"
},
{
"n": 13,
"ko": "접시아래결절",
"en": "infraglenoid tubercle"
}
]
},
{
"ch": "복장뼈",
"img": "img/bone/b09.jpg",
"items": [
{
"n": 1,
"ko": "빗장패임",
"en": "clavicular notch"
},
{
"n": 2,
"ko": "복장뼈자루",
"en": "manubrium of sternum"
},
{
"n": 3,
"ko": "셋째갈비패임",
"en": "3rd costal notch"
},
{
"n": 4,
"ko": "복장뼈몸통",
"en": "body of strenum"
},
{
"n": 5,
"ko": "칼몸통결합",
"en": "xiphisternal joint"
},
{
"n": 6,
"ko": "목아래패임",
"en": "jugular notch"
},
{
"n": 7,
"ko": "복장뼈각",
"en": "sternal angle"
},
{
"n": 8,
"ko": "칼돌기",
"en": "xiphoid process"
}
]
},
{
"ch": "위팔뼈",
"img": "img/bone/b10.jpg",
"items": [
{
"n": 1,
"ko": "작은결절",
"en": "lesser tubercle"
},
{
"n": 2,
"ko": "위팔뼈머리",
"en": "head of humerus"
},
{
"n": 3,
"ko": "큰결절",
"en": "greater tubercle"
},
{
"n": 4,
"ko": "큰결절능선",
"en": "crest of greater tubercle"
},
{
"n": 5,
"ko": "결절사이고랑",
"en": "intertubercular groove"
},
{
"n": 6,
"ko": "작은결절능선",
"en": "crest of lesser tubercle"
},
{
"n": 7,
"ko": "세모근거친면",
"en": "deltoid tuberosity"
},
{
"n": 8,
"ko": "갈고리오목",
"en": "coronoid fossa"
},
{
"n": 9,
"ko": "노오목",
"en": "radial fossa"
},
{
"n": 10,
"ko": "가쪽위관절융기",
"en": "lateral epicondyle"
},
{
"n": 11,
"ko": "작은머리",
"en": "capitulum"
},
{
"n": 12,
"ko": "도드래",
"en": "trochlea"
},
{
"n": 13,
"ko": "해부목",
"en": "anatomical neck"
},
{
"n": 14,
"ko": "외과목",
"en": "surgical neck"
},
{
"n": 15,
"ko": "안쪽위관절융기능선",
"en": "medial supracondylar ridge"
},
{
"n": 16,
"ko": "안쪽위관절융기",
"en": "medial epicondyle"
},
{
"n": 17,
"ko": "팔꿈치오목",
"en": "olecranon fossa"
},
{
"n": 18,
"ko": "가쪽위관절융기능선",
"en": "lateral epicondyle"
},
{
"n": 19,
"ko": "노신경고랑",
"en": "groove for radial nerve"
}
]
},
{
"ch": "아래팔뼈",
"img": "img/bone/b11.jpg",
"items": [
{
"n": 1,
"ko": "팔꿈치머리",
"en": "olecranon"
},
{
"n": 2,
"ko": "자뼈",
"en": "ulna"
},
{
"n": 3,
"ko": "자뼈머리",
"en": "ulnar head"
},
{
"n": 4,
"ko": "노뼈머리",
"en": "radial head"
},
{
"n": 5,
"ko": "노뼈목",
"en": "neck of radius"
},
{
"n": 6,
"ko": "노뼈",
"en": "radius"
},
{
"n": 7,
"ko": "뼈사이모서리",
"en": "interrosseous margin"
},
{
"n": 8,
"ko": "자패임",
"en": "ulnar notch"
},
{
"n": 9,
"ko": "노뼈붓돌기",
"en": "styloid process of radius"
},
{
"n": 10,
"ko": "노뼈머리관절오목",
"en": "fovea of radial head"
},
{
"n": 11,
"ko": "노뼈거친면",
"en": "radial tuberosity"
},
{
"n": 12,
"ko": "도르래패임",
"en": "trochlear notch"
},
{
"n": 13,
"ko": "갈고리돌기",
"en": "coronoid process"
},
{
"n": 14,
"ko": "자뼈거친면",
"en": "ulnar tuberosity"
},
{
"n": 15,
"ko": "노패임",
"en": "radial notch"
},
{
"n": 16,
"ko": "자뼈붓돌기",
"en": "styloid process of ulna"
}
]
},
{
"ch": "넙다리뼈",
"img": "img/bone/b12.jpg",
"items": [
{
"n": 1,
"ko": "큰돌기뼈",
"en": "greater trochanter"
},
{
"n": 2,
"ko": "돌기사이선",
"en": "intertrochanteric line"
},
{
"n": 3,
"ko": "가쪽위관절융기",
"en": "lateral epicondyle"
},
{
"n": 4,
"ko": "무릎면",
"en": "patellar surface"
},
{
"n": 5,
"ko": "가쪽관절융기",
"en": "lateral condyle"
},
{
"n": 6,
"ko": "돌기오목",
"en": "trochanteric fossa"
},
{
"n": 7,
"ko": "돌기사이능선",
"en": "intertrochanteric crest"
},
{
"n": 8,
"ko": "볼기근거친면",
"en": "gluteal tuberosity"
},
{
"n": 9,
"ko": "가쪽관절융기위선",
"en": "lateral supracondylar line"
},
{
"n": 10,
"ko": "오금면",
"en": "popliteal surface"
},
{
"n": 11,
"ko": "넙다리뼈머리오목",
"en": "fovea for ligament of head"
},
{
"n": 12,
"ko": "넙다리뼈머리",
"en": "haed of femur"
},
{
"n": 13,
"ko": "넙다리뼈목",
"en": "neck of femur"
},
{
"n": 14,
"ko": "작은돌기",
"en": "lesser trochanter"
},
{
"n": 15,
"ko": "두덩근선",
"en": "pectineal line"
},
{
"n": 16,
"ko": "거친선",
"en": "linea aspera"
},
{
"n": 17,
"ko": "넙다리뼈몸통",
"en": "body of femur"
},
{
"n": 18,
"ko": "영양구멍",
"en": "nutrient foramen"
},
{
"n": 19,
"ko": "안쪽관절융기위선",
"en": "medial supracondylar line"
},
{
"n": 20,
"ko": "모음근결절",
"en": "adductor tubercle"
},
{
"n": 21,
"ko": "안쪽위관절융기",
"en": "medial epicondyle"
},
{
"n": 22,
"ko": "안쪽관절융기",
"en": "medial condyle"
},
{
"n": 23,
"ko": "융기사이오목",
"en": "intercondylar fossa"
}
]
},
{
"ch": "정강뼈와 종아리뼈",
"img": "img/bone/b13.jpg",
"items": [
{
"n": 1,
"ko": "가쪽관절융기",
"en": "lateral condyle"
},
{
"n": 2,
"ko": "종아리뼈머리",
"en": "head of fibula"
},
{
"n": 3,
"ko": "종아리뼈목",
"en": "neck of fibula"
},
{
"n": 4,
"ko": "가쪽복사",
"en": "lateral malleolus"
},
{
"n": 5,
"ko": "정강뼈거친면",
"en": "tibial tuberosity"
},
{
"n": 6,
"ko": "가자미근선",
"en": "soleal line"
},
{
"n": 7,
"ko": "앞모서리",
"en": "anterior border"
},
{
"n": 8,
"ko": "안쪽복사",
"en": "medial malleolus"
},
{
"n": 9,
"ko": "가쪽복사오목",
"en": "lateral malleolar fossa"
},
{
"n": 10,
"ko": "가쪽복사관절면",
"en": "lateral facet of lateral malleolus"
},
{
"n": 11,
"ko": "융기사이융기",
"en": "intercondylar emience"
}
]
},
{
"ch": "발의뼈",
"img": "img/bone/b14.jpg",
"items": [
{
"n": 1,
"ko": "발허리뼈",
"en": "metatarsal bone"
},
{
"n": 2,
"ko": "안쪽쐐기뼈",
"en": "medial cuneiform"
},
{
"n": 3,
"ko": "중간쐐기뼈",
"en": "intermediate cuneiform"
},
{
"n": 4,
"ko": "가쪽쐐기뼈",
"en": "lateral cuneiform"
},
{
"n": 5,
"ko": "목말뼈",
"en": "talus"
},
{
"n": 6,
"ko": "발꿈치뼈",
"en": "calcaneus"
},
{
"n": 7,
"ko": "입방뼈",
"en": "cuboid"
},
{
"n": 8,
"ko": "발가락뼈",
"en": "phalanges"
},
{
"n": 9,
"ko": "발배뼈",
"en": "navicular"
}
]
},
{
"ch": "손의뼈",
"img": "img/bone/b15.jpg",
"items": [
{
"n": 1,
"ko": "노뼈",
"en": "radius"
},
{
"n": 2,
"ko": "자뼈",
"en": "ulna"
},
{
"n": 3,
"ko": "반달뼈",
"en": "lunate"
},
{
"n": 4,
"ko": "세모뼈",
"en": "triquetrum"
},
{
"n": 5,
"ko": "콩알뼈",
"en": "pisiform"
},
{
"n": 6,
"ko": "알머리뼈",
"en": "capitate"
},
{
"n": 7,
"ko": "갈고리뼈",
"en": "hamate"
},
{
"n": 8,
"ko": "바닥",
"en": "base"
},
{
"n": 9,
"ko": "몸통",
"en": "shaft"
},
{
"n": 10,
"ko": "손허리뼈",
"en": "metacarpal bone"
},
{
"n": 11,
"ko": "머리",
"en": "head"
},
{
"n": 12,
"ko": "바닥",
"en": "base"
},
{
"n": 13,
"ko": "몸통",
"en": "shaft"
},
{
"n": 14,
"ko": "머리",
"en": "head"
},
{
"n": 15,
"ko": "붓돌기",
"en": "styloid process"
},
{
"n": 16,
"ko": "손배뼈",
"en": "scaphoid"
},
{
"n": 17,
"ko": "큰마름뼈",
"en": "trapezium"
},
{
"n": 18,
"ko": "작은마름뼈",
"en": "trapezoid"
},
{
"n": 19,
"ko": "손가락뼈",
"en": "phalanges"
},
{
"n": 20,
"ko": "엄지손가락",
"en": "thum finger"
},
{
"n": 21,
"ko": "집게손가락",
"en": "index finger"
},
{
"n": 22,
"ko": "끝마디뼈거친면",
"en": "tuberosity of distal phalanx"
},
{
"n": 23,
"ko": "가운데손가락",
"en": "middle finger"
},
{
"n": 24,
"ko": "반지손가락",
"en": "ring finger"
},
{
"n": 25,
"ko": "새끼손가락",
"en": "little finger"
}
]
},
{
"ch": "볼기뼈",
"img": "img/bone/b16.jpg",
"items": [
{
"n": 1,
"ko": "엉덩뼈능선",
"en": "iliac crest"
},
{
"n": 2,
"ko": "엉덩뼈",
"en": "ilium"
},
{
"n": 3,
"ko": "위뒤엉덩뼈가시",
"en": "posterior superior iliac spine"
},
{
"n": 4,
"ko": "큰궁둥패임",
"en": "greater sciatic notch"
},
{
"n": 5,
"ko": "궁둥가시",
"en": "ischial spine"
},
{
"n": 6,
"ko": "작은궁둥패임",
"en": "lesser sciatic notch"
},
{
"n": 7,
"ko": "궁둥뼈",
"en": "ischium"
},
{
"n": 8,
"ko": "궁둥뼈결절",
"en": "ischial tuberosity"
},
{
"n": 9,
"ko": "폐쇄구멍",
"en": "obturator foramen"
},
{
"n": 10,
"ko": "두덩뼈",
"en": "pubis"
},
{
"n": 11,
"ko": "절구모서리",
"en": "acetabular margin"
},
{
"n": 12,
"ko": "절구오목",
"en": "acetabular fossa"
},
{
"n": 13,
"ko": "반달면",
"en": "lunate surface"
},
{
"n": 14,
"ko": "절구패임",
"en": "acetabular notch"
},
{
"n": 15,
"ko": "절구",
"en": "acetabulum"
},
{
"n": 16,
"ko": "위앞엉덩뼈가시",
"en": "anterior superior iliac spine"
},
{
"n": 17,
"ko": "볼기면",
"en": "gluteal surface"
},
{
"n": 18,
"ko": "엉덩뼈오목",
"en": "iliac fossa"
},
{
"n": 19,
"ko": "엉덩뼈거친면",
"en": "iliac tuberosity"
},
{
"n": 20,
"ko": "귓바퀴면",
"en": "auricular surface"
}
]
}
]
};
