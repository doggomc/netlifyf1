export const TEAM_LOGO = (slug: string, w: number) => `https://media.formula1.com/image/upload/c_lfill,w_${w}/q_auto/v1740000001/common/f1/2026/${slug}/2026${slug}logowhite.webp`;

export const TEAM_HEX={'McLaren':'#FF8000','Ferrari':'#DC0000','Red Bull':'#1E41FF','Mercedes':'#00D2BE',
 'Williams':'#005AFF','Aston Martin':'#006F62','Alpine F1 Team':'#FF0080','Alpine':'#FF0080',
 'Haas F1 Team':'#B6BABD','Haas':'#B6BABD','Audi':'#E62213','Sauber':'#00E701','RB F1 Team':'#6692FF','Racing Bulls':'#6692FF','Cadillac F1 Team':'#B4A07A','Cadillac':'#B4A07A'};

export const TEAM_ALIAS={'rb f1 team':'racingbulls','racing bulls':'racingbulls','red bull':'redbull',
 'red bull racing':'redbull','alpine f1 team':'alpine','haas f1 team':'haas',
 'cadillac f1 team':'cadillac','aston martin':'astonmartin','sauber':'audi'};

export const DRIVER_PHOTO: Record<string, string> ={
  russell:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/mercedes/georus01/2026mercedesgeorus01right.webp',
  antonelli:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/mercedes/andant01/2026mercedesandant01right.webp',
  leclerc:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/ferrari/chalec01/2026ferrarichalec01right.webp',
  hamilton:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/ferrari/lewham01/2026ferrarilewham01right.webp',
  norris:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/mclaren/lannor01/2026mclarenlannor01right.webp',
  piastri:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/mclaren/oscpia01/2026mclarenoscpia01right.webp',
  verstappen:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/redbullracing/maxver01/2026redbullracingmaxver01right.webp',
  hadjar:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/redbullracing/isahad01/2026redbullracingisahad01right.webp',
  lawson:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/racingbulls/lialaw01/2026racingbullslialaw01right.webp',
  lindblad:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/racingbulls/arvlin01/2026racingbullsarvlin01right.webp',
  gasly:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/alpine/piegas01/2026alpinepiegas01right.webp',
  colapinto:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/alpine/fracol01/2026alpinefracol01right.webp',
  ocon:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/haasf1team/estoco01/2026haasf1teamestoco01right.webp',
  bearman:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/haasf1team/olibea01/2026haasf1teamolibea01right.webp',
  hulkenberg:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/audi/nichul01/2026audinichul01right.webp',
  bortoleto:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/audi/gabbor01/2026audigabbor01right.webp',
  sainz:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/williams/carsai01/2026williamscarsai01right.webp',
  albon:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/williams/alealb01/2026williamsalealb01right.webp',
  alonso:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/astonmartin/feralo01/2026astonmartinferalo01right.webp',
  stroll:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/astonmartin/lanstr01/2026astonmartinlanstr01right.webp',
  perez:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/cadillac/serper01/2026cadillacserper01right.webp',
  bottas:'https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/cadillac/valbot01/2026cadillacvalbot01right.webp'
};

export const DRIVER_KEY: Record<string, string> ={max_verstappen:'verstappen',arvid_lindblad:'lindblad',
 carlos_sainz:'sainz',kevin_magnussen:'magnussen'};
export const photoFor = (id: string) => DRIVER_PHOTO[DRIVER_KEY[id] || id] || null;

export const teams=[
 {id:'default',name:'FreeF1 Red',color:'#E10600',text:'#fff',abbr:'APX'},
 {id:'mclaren',name:'McLaren',color:'#FF8000',text:'#000',abbr:'MCL',logo:'mclaren'},
 {id:'ferrari',name:'Ferrari',color:'#DC0000',text:'#fff',abbr:'FER',logo:'ferrari'},
 {id:'redbull',name:'Red Bull Racing',color:'#1E41FF',text:'#fff',abbr:'RBR',logo:'redbullracing'},
 {id:'mercedes',name:'Mercedes',color:'#00D2BE',text:'#000',abbr:'MER',logo:'mercedes'},
 {id:'williams',name:'Williams',color:'#005AFF',text:'#fff',abbr:'WIL',logo:'williams'},
 {id:'astonmartin',name:'Aston Martin',color:'#006F62',text:'#fff',abbr:'AMR',logo:'astonmartin'},
 {id:'alpine',name:'Alpine',color:'#FF0080',text:'#fff',abbr:'ALP',logo:'alpine'},
 {id:'haas',name:'Haas',color:'#E6E6E6',text:'#000',abbr:'HAA',logo:'haasf1team'},
 {id:'audi',name:'Audi',color:'#E62213',text:'#fff',abbr:'AUD',logo:'audi'},
 {id:'cadillac',name:'Cadillac',color:'#B4A07A',text:'#000',abbr:'CAD',logo:'cadillac'},
 {id:'racingbulls',name:'Racing Bulls',color:'#6692FF',text:'#000',abbr:'RB',logo:'racingbulls'}
];

