export type Category = 'Home' | 'Gifting' | 'Sculptural'
export type Product = {id:string;name:string;price:number;image:string;category:Category[];tag:string;note:string;description:string}

// Approved reference sample catalogue. Confirm inventory and prices before enabling sales.
export const products:Product[]=[
{id:'jar',name:'The Keepsake Jar',price:649,image:'/images/auraflare/jar.webp',category:['Home','Gifting'],tag:'A LITTLE WARMTH',note:'Glass jar · Ivory',description:'A softly glowing glass jar with delicate detailing and a heart-shaped keepsake tag. A lovely finishing touch for an evening in.'},
{id:'pillars',name:'The Fluted Duo',price:799,image:'/images/auraflare/pillars.webp',category:['Home','Sculptural'],tag:'SCULPTURAL EDIT',note:'Pillar pair · Ivory',description:'Two elegant ribbed pillars with a quietly architectural silhouette. Style together on a tray or bring a little height to your favourite corner.'},
{id:'bubble',name:'The Little Bubble',price:349,image:'/images/auraflare/bubble.webp',category:['Home','Gifting','Sculptural'],tag:'SMALL JOYS',note:'Sculptural candle · Ivory',description:'Playful curves, a soft ivory finish and an understated ribbon. A small sculptural detail for a shelf, a table or a thoughtful gift.'},
{id:'violet',name:'Violet in Bloom',price:599,image:'/images/auraflare/violet.webp',category:['Home','Gifting'],tag:'THE FLORAL EDIT',note:'Floral glass candle · Violet',description:'Swirls of violet and ivory beneath a sculpted flower. A colourful little centrepiece that brings a touch of bloom to the everyday.'},
{id:'hearts',name:'A Little Love',price:449,image:'/images/auraflare/hearts.webp',category:['Gifting','Sculptural'],tag:'GIFTING EDIT',note:'Heart candle pair · Ivory',description:'A pair of gentle heart shapes for a thoughtful gesture, a table for two, or a moment worth celebrating.'},
{id:'lotus',name:'The Lotus Light',price:549,image:'/images/auraflare/lotus.webp',category:['Home','Gifting','Sculptural'],tag:'IN FULL BLOOM',note:'Sculptural flower · Ivory',description:'Layered petals and a warm centre create a beautifully delicate focal point. A little flower that makes a space feel special.'},
{id:'glass',name:'The Evening Trio',price:1199,image:'/images/auraflare/glass.webp',category:['Home','Gifting'],tag:'SET THE SCENE',note:'Glass cylinder candle set',description:'Three heights, one lovely glow. A collection of glass cylinder candles for a welcoming table or a restful corner.'},
{id:'tealights',name:'Floating Moments',price:299,image:'/images/auraflare/tealights.webp',category:['Home','Gifting'],tag:'CELEBRATION EDIT',note:'Tealight collection',description:'Small pools of light to make a gathering feel intimate. A simple way to bring warmth to a carefully styled table.'}
]

export const formatPrice=(value:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(value)
