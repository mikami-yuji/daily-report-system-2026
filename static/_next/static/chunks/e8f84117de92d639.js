(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,75254,e=>{"use strict";var t=e.i(71645);let r=e=>{let t=e.replace(/^([A-Z])|[\s-_]+(\w)/g,(e,t,r)=>r?r.toUpperCase():t.toLowerCase());return t.charAt(0).toUpperCase()+t.slice(1)},s=(...e)=>e.filter((e,t,r)=>!!e&&""!==e.trim()&&r.indexOf(e)===t).join(" ").trim();var i={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};let a=(0,t.forwardRef)(({color:e="currentColor",size:r=24,strokeWidth:a=2,absoluteStrokeWidth:n,className:o="",children:l,iconNode:c,...u},d)=>(0,t.createElement)("svg",{ref:d,...i,width:r,height:r,stroke:e,strokeWidth:n?24*Number(a)/Number(r):a,className:s("lucide",o),...!l&&!(e=>{for(let t in e)if(t.startsWith("aria-")||"role"===t||"title"===t)return!0})(u)&&{"aria-hidden":"true"},...u},[...c.map(([e,r])=>(0,t.createElement)(e,r)),...Array.isArray(l)?l:[l]])),n=(e,i)=>{let n=(0,t.forwardRef)(({className:n,...o},l)=>(0,t.createElement)(a,{ref:l,iconNode:i,className:s(`lucide-${r(e).replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase()}`,`lucide-${e}`,n),...o}));return n.displayName=r(e),n};e.s(["default",()=>n],75254)},5766,e=>{"use strict";let t,r;var s,i=e.i(71645);let a={data:""},n=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,o=/\/\*[^]*?\*\/|  +/g,l=/\n+/g,c=(e,t)=>{let r="",s="",i="";for(let a in e){let n=e[a];"@"==a[0]?"i"==a[1]?r=a+" "+n+";":s+="f"==a[1]?c(n,a):a+"{"+c(n,"k"==a[1]?"":t)+"}":"object"==typeof n?s+=c(n,t?t.replace(/([^,])+/g,e=>a.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)):a):null!=n&&(a=/^--/.test(a)?a:a.replace(/[A-Z]/g,"-$&").toLowerCase(),i+=c.p?c.p(a,n):a+":"+n+";")}return r+(t&&i?t+"{"+i+"}":i)+s},u={},d=e=>{if("object"==typeof e){let t="";for(let r in e)t+=r+d(e[r]);return t}return e};function h(e){let t,r,s=this||{},i=e.call?e(s.p):e;return((e,t,r,s,i)=>{var a;let h=d(e),p=u[h]||(u[h]=(e=>{let t=0,r=11;for(;t<e.length;)r=101*r+e.charCodeAt(t++)>>>0;return"go"+r})(h));if(!u[p]){let t=h!==e?e:(e=>{let t,r,s=[{}];for(;t=n.exec(e.replace(o,""));)t[4]?s.shift():t[3]?(r=t[3].replace(l," ").trim(),s.unshift(s[0][r]=s[0][r]||{})):s[0][t[1]]=t[2].replace(l," ").trim();return s[0]})(e);u[p]=c(i?{["@keyframes "+p]:t}:t,r?"":"."+p)}let f=r&&u.g?u.g:null;return r&&(u.g=u[p]),a=u[p],f?t.data=t.data.replace(f,a):-1===t.data.indexOf(a)&&(t.data=s?a+t.data:t.data+a),p})(i.unshift?i.raw?(t=[].slice.call(arguments,1),r=s.p,i.reduce((e,s,i)=>{let a=t[i];if(a&&a.call){let e=a(r),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;a=t?"."+t:e&&"object"==typeof e?e.props?"":c(e,""):!1===e?"":e}return e+s+(null==a?"":a)},"")):i.reduce((e,t)=>Object.assign(e,t&&t.call?t(s.p):t),{}):i,(e=>{if("object"==typeof window){let t=(e?e.querySelector("#_goober"):window._goober)||Object.assign(document.createElement("style"),{innerHTML:" ",id:"_goober"});return t.nonce=window.__nonce__,t.parentNode||(e||document.head).appendChild(t),t.firstChild}return e||a})(s.target),s.g,s.o,s.k)}h.bind({g:1});let p,f,m,y=h.bind({k:1});function g(e,t){let r=this||{};return function(){let s=arguments;function i(a,n){let o=Object.assign({},a),l=o.className||i.className;r.p=Object.assign({theme:f&&f()},o),r.o=/ *go\d+/.test(l),o.className=h.apply(r,s)+(l?" "+l:""),t&&(o.ref=n);let c=e;return e[0]&&(c=o.as||e,delete o.as),m&&c[0]&&m(o),p(c,o)}return t?t(i):i}}var v=(e,t)=>"function"==typeof e?e(t):e,b=(t=0,()=>(++t).toString()),w=()=>{if(void 0===r&&"u">typeof window){let e=matchMedia("(prefers-reduced-motion: reduce)");r=!e||e.matches}return r},S="default",C=(e,t)=>{let{toastLimit:r}=e.settings;switch(t.type){case 0:return{...e,toasts:[t.toast,...e.toasts].slice(0,r)};case 1:return{...e,toasts:e.toasts.map(e=>e.id===t.toast.id?{...e,...t.toast}:e)};case 2:let{toast:s}=t;return C(e,{type:+!!e.toasts.find(e=>e.id===s.id),toast:s});case 3:let{toastId:i}=t;return{...e,toasts:e.toasts.map(e=>e.id===i||void 0===i?{...e,dismissed:!0,visible:!1}:e)};case 4:return void 0===t.toastId?{...e,toasts:[]}:{...e,toasts:e.toasts.filter(e=>e.id!==t.toastId)};case 5:return{...e,pausedAt:t.time};case 6:let a=t.time-(e.pausedAt||0);return{...e,pausedAt:void 0,toasts:e.toasts.map(e=>({...e,pauseDuration:e.pauseDuration+a}))}}},x=[],E={toasts:[],pausedAt:void 0,settings:{toastLimit:20}},O={},T=(e,t=S)=>{O[t]=C(O[t]||E,e),x.forEach(([e,r])=>{e===t&&r(O[t])})},F=e=>Object.keys(O).forEach(t=>T(e,t)),$=(e=S)=>t=>{T(t,e)},A={blank:4e3,error:4e3,success:2e3,loading:1/0,custom:4e3},j=(e={},t=S)=>{let[r,s]=(0,i.useState)(O[t]||E),a=(0,i.useRef)(O[t]);(0,i.useEffect)(()=>(a.current!==O[t]&&s(O[t]),x.push([t,s]),()=>{let e=x.findIndex(([e])=>e===t);e>-1&&x.splice(e,1)}),[t]);let n=r.toasts.map(t=>{var r,s,i;return{...e,...e[t.type],...t,removeDelay:t.removeDelay||(null==(r=e[t.type])?void 0:r.removeDelay)||(null==e?void 0:e.removeDelay),duration:t.duration||(null==(s=e[t.type])?void 0:s.duration)||(null==e?void 0:e.duration)||A[t.type],style:{...e.style,...null==(i=e[t.type])?void 0:i.style,...t.style}}});return{...r,toasts:n}},k=e=>(t,r)=>{let s,i=((e,t="blank",r)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:t,ariaProps:{role:"status","aria-live":"polite"},message:e,pauseDuration:0,...r,id:(null==r?void 0:r.id)||b()}))(t,e,r);return $(i.toasterId||(s=i.id,Object.keys(O).find(e=>O[e].toasts.some(e=>e.id===s))))({type:2,toast:i}),i.id},R=(e,t)=>k("blank")(e,t);R.error=k("error"),R.success=k("success"),R.loading=k("loading"),R.custom=k("custom"),R.dismiss=(e,t)=>{let r={type:3,toastId:e};t?$(t)(r):F(r)},R.dismissAll=e=>R.dismiss(void 0,e),R.remove=(e,t)=>{let r={type:4,toastId:e};t?$(t)(r):F(r)},R.removeAll=e=>R.remove(void 0,e),R.promise=(e,t,r)=>{let s=R.loading(t.loading,{...r,...null==r?void 0:r.loading});return"function"==typeof e&&(e=e()),e.then(e=>{let i=t.success?v(t.success,e):void 0;return i?R.success(i,{id:s,...r,...null==r?void 0:r.success}):R.dismiss(s),e}).catch(e=>{let i=t.error?v(t.error,e):void 0;i?R.error(i,{id:s,...r,...null==r?void 0:r.error}):R.dismiss(s)}),e};var P=1e3,D=(e,t="default")=>{let{toasts:r,pausedAt:s}=j(e,t),a=(0,i.useRef)(new Map).current,n=(0,i.useCallback)((e,t=P)=>{if(a.has(e))return;let r=setTimeout(()=>{a.delete(e),o({type:4,toastId:e})},t);a.set(e,r)},[]);(0,i.useEffect)(()=>{if(s)return;let e=Date.now(),i=r.map(r=>{if(r.duration===1/0)return;let s=(r.duration||0)+r.pauseDuration-(e-r.createdAt);if(s<0){r.visible&&R.dismiss(r.id);return}return setTimeout(()=>R.dismiss(r.id,t),s)});return()=>{i.forEach(e=>e&&clearTimeout(e))}},[r,s,t]);let o=(0,i.useCallback)($(t),[t]),l=(0,i.useCallback)(()=>{o({type:5,time:Date.now()})},[o]),c=(0,i.useCallback)((e,t)=>{o({type:1,toast:{id:e,height:t}})},[o]),u=(0,i.useCallback)(()=>{s&&o({type:6,time:Date.now()})},[s,o]),d=(0,i.useCallback)((e,t)=>{let{reverseOrder:s=!1,gutter:i=8,defaultPosition:a}=t||{},n=r.filter(t=>(t.position||a)===(e.position||a)&&t.height),o=n.findIndex(t=>t.id===e.id),l=n.filter((e,t)=>t<o&&e.visible).length;return n.filter(e=>e.visible).slice(...s?[l+1]:[0,l]).reduce((e,t)=>e+(t.height||0)+i,0)},[r]);return(0,i.useEffect)(()=>{r.forEach(e=>{if(e.dismissed)n(e.id,e.removeDelay);else{let t=a.get(e.id);t&&(clearTimeout(t),a.delete(e.id))}})},[r,n]),{toasts:r,handlers:{updateHeight:c,startPause:l,endPause:u,calculateOffset:d}}},I=y`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,U=y`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,M=y`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,q=g("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${I} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${U} 0.15s ease-out forwards;
    animation-delay: 150ms;
    position: absolute;
    border-radius: 3px;
    opacity: 0;
    background: ${e=>e.secondary||"#fff"};
    bottom: 9px;
    left: 4px;
    height: 2px;
    width: 12px;
  }

  &:before {
    animation: ${M} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,L=y`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,N=g("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${e=>e.secondary||"#e0e0e0"};
  border-right-color: ${e=>e.primary||"#616161"};
  animation: ${L} 1s linear infinite;
`,K=y`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,z=y`
0% {
	height: 0;
	width: 0;
	opacity: 0;
}
40% {
  height: 0;
	width: 6px;
	opacity: 1;
}
100% {
  opacity: 1;
  height: 10px;
}`,H=g("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${K} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${z} 0.2s ease-out forwards;
    opacity: 0;
    animation-delay: 200ms;
    position: absolute;
    border-right: 2px solid;
    border-bottom: 2px solid;
    border-color: ${e=>e.secondary||"#fff"};
    bottom: 6px;
    left: 6px;
    height: 10px;
    width: 6px;
  }
`,Q=g("div")`
  position: absolute;
`,_=g("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,G=y`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,B=g("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${G} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,Z=({toast:e})=>{let{icon:t,type:r,iconTheme:s}=e;return void 0!==t?"string"==typeof t?i.createElement(B,null,t):t:"blank"===r?null:i.createElement(_,null,i.createElement(N,{...s}),"loading"!==r&&i.createElement(Q,null,"error"===r?i.createElement(q,{...s}):i.createElement(H,{...s})))},W=g("div")`
  display: flex;
  align-items: center;
  background: #fff;
  color: #363636;
  line-height: 1.3;
  will-change: transform;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1), 0 3px 3px rgba(0, 0, 0, 0.05);
  max-width: 350px;
  pointer-events: auto;
  padding: 8px 10px;
  border-radius: 8px;
`,V=g("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`,J=i.memo(({toast:e,position:t,style:r,children:s})=>{let a=e.height?((e,t)=>{let r=e.includes("top")?1:-1,[s,i]=w()?["0%{opacity:0;} 100%{opacity:1;}","0%{opacity:1;} 100%{opacity:0;}"]:[`
0% {transform: translate3d(0,${-200*r}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${-150*r}%,-1px) scale(.6); opacity:0;}
`];return{animation:t?`${y(s)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${y(i)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}})(e.position||t||"top-center",e.visible):{opacity:0},n=i.createElement(Z,{toast:e}),o=i.createElement(V,{...e.ariaProps},v(e.message,e));return i.createElement(W,{className:e.className,style:{...a,...r,...e.style}},"function"==typeof s?s({icon:n,message:o}):i.createElement(i.Fragment,null,n,o))});s=i.createElement,c.p=void 0,p=s,f=void 0,m=void 0;var Y=({id:e,className:t,style:r,onHeightUpdate:s,children:a})=>{let n=i.useCallback(t=>{if(t){let r=()=>{s(e,t.getBoundingClientRect().height)};r(),new MutationObserver(r).observe(t,{subtree:!0,childList:!0,characterData:!0})}},[e,s]);return i.createElement("div",{ref:n,className:t,style:r},a)},X=h`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`,ee=({reverseOrder:e,position:t="top-center",toastOptions:r,gutter:s,children:a,toasterId:n,containerStyle:o,containerClassName:l})=>{let{toasts:c,handlers:u}=D(r,n);return i.createElement("div",{"data-rht-toaster":n||"",style:{position:"fixed",zIndex:9999,top:16,left:16,right:16,bottom:16,pointerEvents:"none",...o},className:l,onMouseEnter:u.startPause,onMouseLeave:u.endPause},c.map(r=>{let n,o,l=r.position||t,c=u.calculateOffset(r,{reverseOrder:e,gutter:s,defaultPosition:t}),d=(n=l.includes("top"),o=l.includes("center")?{justifyContent:"center"}:l.includes("right")?{justifyContent:"flex-end"}:{},{left:0,right:0,display:"flex",position:"absolute",transition:w()?void 0:"all 230ms cubic-bezier(.21,1.02,.73,1)",transform:`translateY(${c*(n?1:-1)}px)`,...n?{top:0}:{bottom:0},...o});return i.createElement(Y,{id:r.id,key:r.id,onHeightUpdate:u.updateHeight,className:r.visible?X:"",style:d},"custom"===r.type?v(r.message,r):a?a(r):i.createElement(J,{toast:r,position:l}))}))};e.s(["CheckmarkIcon",()=>H,"ErrorIcon",()=>q,"LoaderIcon",()=>N,"ToastBar",()=>J,"ToastIcon",()=>Z,"Toaster",()=>ee,"default",()=>R,"resolveValue",()=>v,"toast",()=>R,"useToaster",()=>D,"useToasterStore",()=>j],5766)},78138,9165,e=>{"use strict";var t=e.i(43476),r=e.i(71645),s=e.i(81949),i=e.i(5766);let a="/api",n=s.default.create({timeout:3e4}),o=s.default.create({timeout:6e4}),l=e=>{let t=e.response?.data?.detail||e.response?.data?.message||e.message||"通信エラーが発生しました";return console.error("API Error:",e),i.default.error(`通信エラー: ${t}`),Promise.reject(e)};n.interceptors.response.use(e=>e,l),o.interceptors.response.use(e=>e,l);let c=async()=>(await n.get(`${a}/files`)).data,u=async e=>{let t=await n.get(`${a}/reports`,{params:e?{filename:e}:{}});return Array.isArray(t.data)?t.data:(console.warn("getReports received non-array data:",t.data),[])},d=async(e,t)=>(await o.post(`${a}/reports`,e,{params:t?{filename:t}:{}})).data,h=async(e,t,r)=>(await o.post(`${a}/reports/${e}`,t,{params:r?{filename:r}:{}})).data,p=async(e,t,r)=>(await n.patch(`${a}/reports/${e}/reply`,{コメント返信欄:t},{params:r?{filename:r}:{}})).data,f=async(e,t,r)=>(await n.patch(`${a}/reports/${e}/comment`,t,{params:r?{filename:r}:{}})).data,m=async(e,t,r)=>(await n.patch(`${a}/reports/${e}/approval`,t,{params:r?{filename:r}:{}})).data,y=async(e,t)=>(await n.delete(`${a}/reports/${e}`,{params:t?{filename:t}:{}})).data,g=async e=>{let t=await n.get(`${a}/priority-customers`,{params:e?{filename:e}:{}});return Array.isArray(t.data)?t.data:(console.warn("getPriorityCustomers received non-array data:",t.data),[])},v=async e=>{let t=new FormData;return t.append("file",e),(await o.post(`${a}/upload`,t,{headers:{"Content-Type":"multipart/form-data"}})).data},b=async e=>(await n.get(`${a}/customers`,{params:e?{filename:e}:{}})).data,w=async(e,t,r,s)=>{let i={};return t&&(i.filename=t),r&&(i.customer_name=r),s&&(i.delivery_name=s),(await n.get(`${a}/interviewers/${encodeURIComponent(e)}`,{params:i})).data.interviewers},S=async(e,t,r)=>{let s={};return t&&(s.filename=t),r&&(s.delivery_name=r),(await n.get(`${a}/designs/${e}`,{params:s})).data.designs},C=async e=>{try{return(await o.get(`${a}/images/list`,{params:{filename:e}})).data}catch(e){return console.error("Error fetching design images:",e),{images:[],message:"Failed to fetch images"}}},x=async(e,t)=>{try{let r={query:e};return t&&(r.filename=t),(await o.get(`${a}/images/search`,{params:r})).data}catch(e){return console.error("Error searching design images:",e),{images:[],message:"Failed to search images"}}},E=async e=>(await n.get(`${a}/stats/dashboard`,{params:e?{filename:e}:{}})).data,O=async(e,t)=>{let r={month:t};return e&&(r.filename=e),(await n.get(`${a}/stats/monthly-summary`,{params:r})).data},T=async()=>{try{let e=await n.get(`${a}/sales/all`);if(!Array.isArray(e.data))return console.warn("getAllSales received non-array data:",e.data),[];return e.data}catch(e){return console.error("Error fetching all sales data:",e),[]}};e.s(["addReport",0,d,"deleteReport",0,y,"getAllSales",0,T,"getCustomers",0,b,"getDashboardStats",0,E,"getDesignImages",0,C,"getDesigns",0,S,"getFiles",0,c,"getImageUrl",0,e=>`${a}/images/content?path=${encodeURIComponent(e)}`,"getInterviewers",0,w,"getMonthlySummaryStats",0,O,"getPriorityCustomers",0,g,"getReports",0,u,"searchDesignImages",0,x,"updateReport",0,h,"updateReportApproval",0,m,"updateReportComment",0,f,"updateReportReply",0,p,"uploadFile",0,v],9165);let F=(0,r.createContext)(void 0);function $({children:e}){let[s,i]=(0,r.useState)(""),[a,n]=(0,r.useState)([]),[o,l]=(0,r.useState)(!0),u=r.default.useRef(s);(0,r.useEffect)(()=>{u.current=s,s&&localStorage.setItem("selectedFile",s)},[s]);let d=async e=>{try{l(!0);let t=await c();n(t.files);let r=void 0!==e?e:u.current;!r&&t.default?i(t.default):r&&!t.files.find(e=>e.name===r)&&(console.warn(`Selected file ${r} not found in updated list. Reverting to default.`),i(t.default))}catch(e){console.error("Failed to load files:",e)}finally{l(!1)}};return(0,r.useEffect)(()=>{let e=localStorage.getItem("selectedFile");e&&i(e),d(e||void 0)},[]),(0,t.jsx)(F.Provider,{value:{selectedFile:s,setSelectedFile:i,files:a,setFiles:n,isLoadingFiles:o,refreshFiles:d},children:e})}function A(){let e=(0,r.useContext)(F);if(void 0===e)throw Error("useFile must be used within a FileProvider");return e}e.s(["FileProvider",()=>$,"useFile",()=>A],78138)},19273,80166,e=>{"use strict";e.i(47167);var t={setTimeout:(e,t)=>setTimeout(e,t),clearTimeout:e=>clearTimeout(e),setInterval:(e,t)=>setInterval(e,t),clearInterval:e=>clearInterval(e)},r=new class{#e=t;#t=!1;setTimeoutProvider(e){this.#e=e}setTimeout(e,t){return this.#e.setTimeout(e,t)}clearTimeout(e){this.#e.clearTimeout(e)}setInterval(e,t){return this.#e.setInterval(e,t)}clearInterval(e){this.#e.clearInterval(e)}};function s(e){setTimeout(e,0)}e.s(["systemSetTimeoutZero",()=>s,"timeoutManager",()=>r],80166);var i="undefined"==typeof window||"Deno"in globalThis;function a(){}function n(e,t){return"function"==typeof e?e(t):e}function o(e){return"number"==typeof e&&e>=0&&e!==1/0}function l(e,t){return Math.max(e+(t||0)-Date.now(),0)}function c(e,t){return"function"==typeof e?e(t):e}function u(e,t){return"function"==typeof e?e(t):e}function d(e,t){let{type:r="all",exact:s,fetchStatus:i,predicate:a,queryKey:n,stale:o}=e;if(n){if(s){if(t.queryHash!==p(n,t.options))return!1}else if(!m(t.queryKey,n))return!1}if("all"!==r){let e=t.isActive();if("active"===r&&!e||"inactive"===r&&e)return!1}return("boolean"!=typeof o||t.isStale()===o)&&(!i||i===t.state.fetchStatus)&&(!a||!!a(t))}function h(e,t){let{exact:r,status:s,predicate:i,mutationKey:a}=e;if(a){if(!t.options.mutationKey)return!1;if(r){if(f(t.options.mutationKey)!==f(a))return!1}else if(!m(t.options.mutationKey,a))return!1}return(!s||t.state.status===s)&&(!i||!!i(t))}function p(e,t){return(t?.queryKeyHashFn||f)(e)}function f(e){return JSON.stringify(e,(e,t)=>b(t)?Object.keys(t).sort().reduce((e,r)=>(e[r]=t[r],e),{}):t)}function m(e,t){return e===t||typeof e==typeof t&&!!e&&!!t&&"object"==typeof e&&"object"==typeof t&&Object.keys(t).every(r=>m(e[r],t[r]))}var y=Object.prototype.hasOwnProperty;function g(e,t){if(!t||Object.keys(e).length!==Object.keys(t).length)return!1;for(let r in e)if(e[r]!==t[r])return!1;return!0}function v(e){return Array.isArray(e)&&e.length===Object.keys(e).length}function b(e){if(!w(e))return!1;let t=e.constructor;if(void 0===t)return!0;let r=t.prototype;return!!w(r)&&!!r.hasOwnProperty("isPrototypeOf")&&Object.getPrototypeOf(e)===Object.prototype}function w(e){return"[object Object]"===Object.prototype.toString.call(e)}function S(e){return new Promise(t=>{r.setTimeout(t,e)})}function C(e,t,r){return"function"==typeof r.structuralSharing?r.structuralSharing(e,t):!1!==r.structuralSharing?function e(t,r){if(t===r)return t;let s=v(t)&&v(r);if(!s&&!(b(t)&&b(r)))return r;let i=(s?t:Object.keys(t)).length,a=s?r:Object.keys(r),n=a.length,o=s?Array(n):{},l=0;for(let c=0;c<n;c++){let n=s?c:a[c],u=t[n],d=r[n];if(u===d){o[n]=u,(s?c<i:y.call(t,n))&&l++;continue}if(null===u||null===d||"object"!=typeof u||"object"!=typeof d){o[n]=d;continue}let h=e(u,d);o[n]=h,h===u&&l++}return i===n&&l===i?t:o}(e,t):t}function x(e,t,r=0){let s=[...e,t];return r&&s.length>r?s.slice(1):s}function E(e,t,r=0){let s=[t,...e];return r&&s.length>r?s.slice(0,-1):s}var O=Symbol();function T(e,t){return!e.queryFn&&t?.initialPromise?()=>t.initialPromise:e.queryFn&&e.queryFn!==O?e.queryFn:()=>Promise.reject(Error(`Missing queryFn: '${e.queryHash}'`))}function F(e,t){return"function"==typeof e?e(...t):!!e}e.s(["addToEnd",()=>x,"addToStart",()=>E,"ensureQueryFn",()=>T,"functionalUpdate",()=>n,"hashKey",()=>f,"hashQueryKeyByOptions",()=>p,"isServer",()=>i,"isValidTimeout",()=>o,"matchMutation",()=>h,"matchQuery",()=>d,"noop",()=>a,"partialMatchKey",()=>m,"replaceData",()=>C,"resolveEnabled",()=>u,"resolveStaleTime",()=>c,"shallowEqualObjects",()=>g,"shouldThrowError",()=>F,"skipToken",()=>O,"sleep",()=>S,"timeUntilStale",()=>l],19273)},40143,e=>{"use strict";let t,r,s,i,a,n;var o=e.i(80166).systemSetTimeoutZero,l=(t=[],r=0,s=e=>{e()},i=e=>{e()},a=o,{batch:e=>{let n;r++;try{n=e()}finally{let e;--r||(e=t,t=[],e.length&&a(()=>{i(()=>{e.forEach(e=>{s(e)})})}))}return n},batchCalls:e=>(...t)=>{n(()=>{e(...t)})},schedule:n=e=>{r?t.push(e):a(()=>{s(e)})},setNotifyFunction:e=>{s=e},setBatchNotifyFunction:e=>{i=e},setScheduler:e=>{a=e}});e.s(["notifyManager",()=>l])},15823,e=>{"use strict";var t=class{constructor(){this.listeners=new Set,this.subscribe=this.subscribe.bind(this)}subscribe(e){return this.listeners.add(e),this.onSubscribe(),()=>{this.listeners.delete(e),this.onUnsubscribe()}}hasListeners(){return this.listeners.size>0}onSubscribe(){}onUnsubscribe(){}};e.s(["Subscribable",()=>t])},75555,e=>{"use strict";var t=e.i(15823),r=e.i(19273),s=new class extends t.Subscribable{#r;#s;#i;constructor(){super(),this.#i=e=>{if(!r.isServer&&window.addEventListener){let t=()=>e();return window.addEventListener("visibilitychange",t,!1),()=>{window.removeEventListener("visibilitychange",t)}}}}onSubscribe(){this.#s||this.setEventListener(this.#i)}onUnsubscribe(){this.hasListeners()||(this.#s?.(),this.#s=void 0)}setEventListener(e){this.#i=e,this.#s?.(),this.#s=e(e=>{"boolean"==typeof e?this.setFocused(e):this.onFocus()})}setFocused(e){this.#r!==e&&(this.#r=e,this.onFocus())}onFocus(){let e=this.isFocused();this.listeners.forEach(t=>{t(e)})}isFocused(){return"boolean"==typeof this.#r?this.#r:globalThis.document?.visibilityState!=="hidden"}};e.s(["focusManager",()=>s])},86491,14448,93803,36553,88587,12598,e=>{"use strict";e.i(47167);var t=e.i(19273),r=e.i(40143),s=e.i(75555),i=e.i(15823),a=new class extends i.Subscribable{#a=!0;#s;#i;constructor(){super(),this.#i=e=>{if(!t.isServer&&window.addEventListener){let t=()=>e(!0),r=()=>e(!1);return window.addEventListener("online",t,!1),window.addEventListener("offline",r,!1),()=>{window.removeEventListener("online",t),window.removeEventListener("offline",r)}}}}onSubscribe(){this.#s||this.setEventListener(this.#i)}onUnsubscribe(){this.hasListeners()||(this.#s?.(),this.#s=void 0)}setEventListener(e){this.#i=e,this.#s?.(),this.#s=e(this.setOnline.bind(this))}setOnline(e){this.#a!==e&&(this.#a=e,this.listeners.forEach(t=>{t(e)}))}isOnline(){return this.#a}};function n(){let e,t,r=new Promise((r,s)=>{e=r,t=s});function s(e){Object.assign(r,e),delete r.resolve,delete r.reject}return r.status="pending",r.catch(()=>{}),r.resolve=t=>{s({status:"fulfilled",value:t}),e(t)},r.reject=e=>{s({status:"rejected",reason:e}),t(e)},r}function o(e){return Math.min(1e3*2**e,3e4)}function l(e){return(e??"online")!=="online"||a.isOnline()}e.s(["onlineManager",()=>a],14448),e.s(["pendingThenable",()=>n],93803);var c=class extends Error{constructor(e){super("CancelledError"),this.revert=e?.revert,this.silent=e?.silent}};function u(e){let r,i=!1,u=0,d=n(),h=()=>s.focusManager.isFocused()&&("always"===e.networkMode||a.isOnline())&&e.canRun(),p=()=>l(e.networkMode)&&e.canRun(),f=e=>{"pending"===d.status&&(r?.(),d.resolve(e))},m=e=>{"pending"===d.status&&(r?.(),d.reject(e))},y=()=>new Promise(t=>{r=e=>{("pending"!==d.status||h())&&t(e)},e.onPause?.()}).then(()=>{r=void 0,"pending"===d.status&&e.onContinue?.()}),g=()=>{let r;if("pending"!==d.status)return;let s=0===u?e.initialPromise:void 0;try{r=s??e.fn()}catch(e){r=Promise.reject(e)}Promise.resolve(r).then(f).catch(r=>{if("pending"!==d.status)return;let s=e.retry??3*!t.isServer,a=e.retryDelay??o,n="function"==typeof a?a(u,r):a,l=!0===s||"number"==typeof s&&u<s||"function"==typeof s&&s(u,r);i||!l?m(r):(u++,e.onFail?.(u,r),(0,t.sleep)(n).then(()=>h()?void 0:y()).then(()=>{i?m(r):g()}))})};return{promise:d,status:()=>d.status,cancel:t=>{if("pending"===d.status){let r=new c(t);m(r),e.onCancel?.(r)}},continue:()=>(r?.(),d),cancelRetry:()=>{i=!0},continueRetry:()=>{i=!1},canStart:p,start:()=>(p()?g():y().then(g),d)}}e.s(["CancelledError",()=>c,"canFetch",()=>l,"createRetryer",()=>u],36553);var d=e.i(80166),h=class{#n;destroy(){this.clearGcTimeout()}scheduleGc(){this.clearGcTimeout(),(0,t.isValidTimeout)(this.gcTime)&&(this.#n=d.timeoutManager.setTimeout(()=>{this.optionalRemove()},this.gcTime))}updateGcTime(e){this.gcTime=Math.max(this.gcTime||0,e??(t.isServer?1/0:3e5))}clearGcTimeout(){this.#n&&(d.timeoutManager.clearTimeout(this.#n),this.#n=void 0)}};e.s(["Removable",()=>h],88587);var p=class extends h{#o;#l;#c;#u;#d;#h;#p;constructor(e){super(),this.#p=!1,this.#h=e.defaultOptions,this.setOptions(e.options),this.observers=[],this.#u=e.client,this.#c=this.#u.getQueryCache(),this.queryKey=e.queryKey,this.queryHash=e.queryHash,this.#o=y(this.options),this.state=e.state??this.#o,this.scheduleGc()}get meta(){return this.options.meta}get promise(){return this.#d?.promise}setOptions(e){if(this.options={...this.#h,...e},this.updateGcTime(this.options.gcTime),this.state&&void 0===this.state.data){let e=y(this.options);void 0!==e.data&&(this.setState(m(e.data,e.dataUpdatedAt)),this.#o=e)}}optionalRemove(){this.observers.length||"idle"!==this.state.fetchStatus||this.#c.remove(this)}setData(e,r){let s=(0,t.replaceData)(this.state.data,e,this.options);return this.#f({data:s,type:"success",dataUpdatedAt:r?.updatedAt,manual:r?.manual}),s}setState(e,t){this.#f({type:"setState",state:e,setStateOptions:t})}cancel(e){let r=this.#d?.promise;return this.#d?.cancel(e),r?r.then(t.noop).catch(t.noop):Promise.resolve()}destroy(){super.destroy(),this.cancel({silent:!0})}reset(){this.destroy(),this.setState(this.#o)}isActive(){return this.observers.some(e=>!1!==(0,t.resolveEnabled)(e.options.enabled,this))}isDisabled(){return this.getObserversCount()>0?!this.isActive():this.options.queryFn===t.skipToken||this.state.dataUpdateCount+this.state.errorUpdateCount===0}isStatic(){return this.getObserversCount()>0&&this.observers.some(e=>"static"===(0,t.resolveStaleTime)(e.options.staleTime,this))}isStale(){return this.getObserversCount()>0?this.observers.some(e=>e.getCurrentResult().isStale):void 0===this.state.data||this.state.isInvalidated}isStaleByTime(e=0){return void 0===this.state.data||"static"!==e&&(!!this.state.isInvalidated||!(0,t.timeUntilStale)(this.state.dataUpdatedAt,e))}onFocus(){let e=this.observers.find(e=>e.shouldFetchOnWindowFocus());e?.refetch({cancelRefetch:!1}),this.#d?.continue()}onOnline(){let e=this.observers.find(e=>e.shouldFetchOnReconnect());e?.refetch({cancelRefetch:!1}),this.#d?.continue()}addObserver(e){this.observers.includes(e)||(this.observers.push(e),this.clearGcTimeout(),this.#c.notify({type:"observerAdded",query:this,observer:e}))}removeObserver(e){this.observers.includes(e)&&(this.observers=this.observers.filter(t=>t!==e),this.observers.length||(this.#d&&(this.#p?this.#d.cancel({revert:!0}):this.#d.cancelRetry()),this.scheduleGc()),this.#c.notify({type:"observerRemoved",query:this,observer:e}))}getObserversCount(){return this.observers.length}invalidate(){this.state.isInvalidated||this.#f({type:"invalidate"})}async fetch(e,r){let s;if("idle"!==this.state.fetchStatus&&this.#d?.status()!=="rejected"){if(void 0!==this.state.data&&r?.cancelRefetch)this.cancel({silent:!0});else if(this.#d)return this.#d.continueRetry(),this.#d.promise}if(e&&this.setOptions(e),!this.options.queryFn){let e=this.observers.find(e=>e.options.queryFn);e&&this.setOptions(e.options)}let i=new AbortController,a=e=>{Object.defineProperty(e,"signal",{enumerable:!0,get:()=>(this.#p=!0,i.signal)})},n=()=>{let e,s=(0,t.ensureQueryFn)(this.options,r),i=(a(e={client:this.#u,queryKey:this.queryKey,meta:this.meta}),e);return(this.#p=!1,this.options.persister)?this.options.persister(s,i,this):s(i)},o=(a(s={fetchOptions:r,options:this.options,queryKey:this.queryKey,client:this.#u,state:this.state,fetchFn:n}),s);this.options.behavior?.onFetch(o,this),this.#l=this.state,("idle"===this.state.fetchStatus||this.state.fetchMeta!==o.fetchOptions?.meta)&&this.#f({type:"fetch",meta:o.fetchOptions?.meta}),this.#d=u({initialPromise:r?.initialPromise,fn:o.fetchFn,onCancel:e=>{e instanceof c&&e.revert&&this.setState({...this.#l,fetchStatus:"idle"}),i.abort()},onFail:(e,t)=>{this.#f({type:"failed",failureCount:e,error:t})},onPause:()=>{this.#f({type:"pause"})},onContinue:()=>{this.#f({type:"continue"})},retry:o.options.retry,retryDelay:o.options.retryDelay,networkMode:o.options.networkMode,canRun:()=>!0});try{let e=await this.#d.start();if(void 0===e)throw Error(`${this.queryHash} data is undefined`);return this.setData(e),this.#c.config.onSuccess?.(e,this),this.#c.config.onSettled?.(e,this.state.error,this),e}catch(e){if(e instanceof c){if(e.silent)return this.#d.promise;else if(e.revert){if(void 0===this.state.data)throw e;return this.state.data}}throw this.#f({type:"error",error:e}),this.#c.config.onError?.(e,this),this.#c.config.onSettled?.(this.state.data,e,this),e}finally{this.scheduleGc()}}#f(e){let t=t=>{switch(e.type){case"failed":return{...t,fetchFailureCount:e.failureCount,fetchFailureReason:e.error};case"pause":return{...t,fetchStatus:"paused"};case"continue":return{...t,fetchStatus:"fetching"};case"fetch":return{...t,...f(t.data,this.options),fetchMeta:e.meta??null};case"success":let r={...t,...m(e.data,e.dataUpdatedAt),dataUpdateCount:t.dataUpdateCount+1,...!e.manual&&{fetchStatus:"idle",fetchFailureCount:0,fetchFailureReason:null}};return this.#l=e.manual?r:void 0,r;case"error":let s=e.error;return{...t,error:s,errorUpdateCount:t.errorUpdateCount+1,errorUpdatedAt:Date.now(),fetchFailureCount:t.fetchFailureCount+1,fetchFailureReason:s,fetchStatus:"idle",status:"error"};case"invalidate":return{...t,isInvalidated:!0};case"setState":return{...t,...e.state}}};this.state=t(this.state),r.notifyManager.batch(()=>{this.observers.forEach(e=>{e.onQueryUpdate()}),this.#c.notify({query:this,type:"updated",action:e})})}};function f(e,t){return{fetchFailureCount:0,fetchFailureReason:null,fetchStatus:l(t.networkMode)?"fetching":"paused",...void 0===e&&{error:null,status:"pending"}}}function m(e,t){return{data:e,dataUpdatedAt:t??Date.now(),error:null,isInvalidated:!1,status:"success"}}function y(e){let t="function"==typeof e.initialData?e.initialData():e.initialData,r=void 0!==t,s=r?"function"==typeof e.initialDataUpdatedAt?e.initialDataUpdatedAt():e.initialDataUpdatedAt:0;return{data:t,dataUpdateCount:0,dataUpdatedAt:r?s??Date.now():0,error:null,errorUpdateCount:0,errorUpdatedAt:0,fetchFailureCount:0,fetchFailureReason:null,fetchMeta:null,isInvalidated:!1,status:r?"success":"pending",fetchStatus:"idle"}}e.s(["Query",()=>p,"fetchState",()=>f],86491);var g=e.i(71645),v=e.i(43476),b=g.createContext(void 0),w=e=>{let t=g.useContext(b);if(e)return e;if(!t)throw Error("No QueryClient set, use QueryClientProvider to set one");return t},S=({client:e,children:t})=>(g.useEffect(()=>(e.mount(),()=>{e.unmount()}),[e]),(0,v.jsx)(b.Provider,{value:e,children:t}));e.s(["QueryClientProvider",()=>S,"useQueryClient",()=>w],12598)}]);