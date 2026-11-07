export const TEAM_LOGO = (slug: string, w: number) => `https://media.formula1.com/image/upload/c_lfill,w_${w}/q_auto/v1740000001/common/f1/2026/${slug}/2026${slug}logowhite.webp`;

/* The 2026 car, on the livery's dark background, for the constructors' leader
   card. Same CDN and slug as the logo; each team has one. */
export const TEAM_CAR = (slug: string, w: number) => `https://media.formula1.com/image/upload/c_lfill,w_${w}/q_auto/v1740000001/common/f1/2026/${slug}/2026${slug}carright.webp`;

export const TEAM_HEX={'McLaren':'#FF8000','Ferrari':'#DC0000','Red Bull':'#1E41FF','Mercedes':'#00D2BE',
 'Williams':'#005AFF','Aston Martin':'#006F62','Alpine F1 Team':'#FF0080','Alpine':'#FF0080',
 'Haas F1 Team':'#B6BABD','Haas':'#B6BABD','Audi':'#E62213','Sauber':'#00E701','RB F1 Team':'#6692FF','Racing Bulls':'#6692FF','Cadillac F1 Team':'#B4A07A','Cadillac':'#B4A07A'};

export const TEAM_ALIAS={'rb f1 team':'racingbulls','racing bulls':'racingbulls','red bull':'redbull',
 'red bull racing':'redbull','alpine f1 team':'alpine','haas f1 team':'haas',
 'cadillac f1 team':'cadillac','aston martin':'astonmartin','sauber':'audi'};


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

