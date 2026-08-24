import { ASSETS } from "./assets.js";

export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.gm { --paper:#E4E8DF; --form:#FCFCF8; --ink:#151814; --ink2:#5A6157;
      --rule:#AEB6A8; --grid:#CFDACD; --seal:#8E2B34; --assay:#2C5648;
      background:var(--paper); color:var(--ink); min-height:100vh;
      font-family:'IBM Plex Mono','Apple SD Gothic Neo','Malgun Gothic',sans-serif;
      padding:28px 16px 80px; }
.gm *{box-sizing:border-box;}
.gm-serif{font-family:'Nanum Myeongjo','Batang',serif;}
.gm-sheet{max-width:880px;margin:0 auto;background:var(--form);
      border:1px solid var(--ink);box-shadow:3px 3px 0 rgba(21,24,20,.14);}

/* header */
.gm-hd{border-bottom:2px solid var(--ink);padding:20px 26px 16px;position:relative;}
.gm-inst{font-size:10px;letter-spacing:.34em;color:var(--ink2);text-transform:uppercase;}
.gm-title{font-size:26px;font-weight:800;letter-spacing:-.02em;margin:8px 0 2px;line-height:1.25;}
.gm-sub{font-size:11px;color:var(--ink2);letter-spacing:.08em;}
.gm-bars{display:flex;gap:2px;margin-top:14px;height:22px;align-items:flex-end;}
.gm-bars i{display:block;background:var(--ink);width:2px;height:100%;}
.gm-bars i:nth-child(3n){width:4px;} .gm-bars i:nth-child(4n){height:70%;}
.gm-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));
      border-top:1px solid var(--rule);margin-top:16px;}
.gm-meta div{padding:7px 0 0;font-size:11px;}
.gm-meta span{display:block;color:var(--ink2);font-size:9px;letter-spacing:.18em;margin-bottom:3px;}

/* section */
.gm-sec{border-bottom:1px solid var(--rule);padding:22px 26px 26px;}
.gm-sec:last-child{border-bottom:none;}
.gm-num{display:flex;align-items:baseline;gap:10px;margin-bottom:16px;}
.gm-num b{font-size:13px;font-weight:600;letter-spacing:.06em;}
.gm-num em{font-style:normal;font-size:9px;color:var(--ink2);letter-spacing:.2em;}
.gm-num:before{content:'';flex:0 0 26px;height:1px;background:var(--ink);align-self:center;}

/* form fields */
.gm-lbl{font-size:9px;letter-spacing:.2em;color:var(--ink2);margin-bottom:5px;display:block;}
.gm-in,.gm-ta{width:100%;background:transparent;border:none;border-bottom:1px solid var(--rule);
      padding:7px 2px;font:inherit;font-size:13px;color:var(--ink);outline:none;border-radius:0;}
.gm-ta{border:1px solid var(--rule);background:
      repeating-linear-gradient(var(--form) 0 25px,var(--grid) 25px 26px);
      line-height:26px;padding:6px 9px;min-height:158px;resize:vertical;font-size:12.5px;}
.gm-in:focus,.gm-ta:focus{border-color:var(--assay);box-shadow:0 1px 0 var(--assay);}
.gm-grid2{display:grid;grid-template-columns:1fr 1fr;gap:26px;}
@media(max-width:640px){.gm-grid2{grid-template-columns:1fr;}}

.gm-drop{border:1px dashed var(--rule);height:96px;display:flex;align-items:center;
      justify-content:center;font-size:10px;color:var(--ink2);cursor:pointer;
      letter-spacing:.12em;overflow:hidden;position:relative;background:var(--form);}
.gm-drop:hover{border-color:var(--assay);color:var(--assay);}
.gm-drop img{width:100%;height:100%;object-fit:cover;filter:grayscale(.35) contrast(1.05);}

.gm-q{border-top:1px solid var(--grid);padding:13px 0;}
.gm-q p{font-size:12.5px;margin:0 0 9px;}
.gm-q p b{color:var(--ink2);font-size:9px;letter-spacing:.18em;margin-right:8px;}
.gm-opts{display:flex;flex-wrap:wrap;gap:6px;}
.gm-opt{border:1px solid var(--rule);background:transparent;padding:5px 11px;font:inherit;
      font-size:11.5px;color:var(--ink2);cursor:pointer;border-radius:0;}
.gm-opt:hover{border-color:var(--ink);color:var(--ink);}
.gm-opt[data-on="1"]{background:var(--ink);border-color:var(--ink);color:var(--form);}
.gm-kw{margin-top:11px;}
.gm-kw>div{margin-bottom:9px;}
.gm-kw>div>span{display:block;font-size:9px;letter-spacing:.18em;color:var(--ink2);margin-bottom:5px;}
.gm-kwbtn{font-size:10.5px;padding:3px 9px;}
.gm-entry{border-top:1px solid var(--grid);padding:15px 0 6px;}
.gm-entry:first-of-type{border-top:none;padding-top:0;}
.gm-entry-hd{display:grid;grid-template-columns:minmax(0,1fr) minmax(180px,240px);
      align-items:start;gap:14px;margin-bottom:10px;}
.gm-entry-hd>span{font-size:9px;letter-spacing:.2em;color:var(--ink2);}
@media(max-width:640px){.gm-entry-hd{grid-template-columns:1fr;}.gm-entry-hd>span{order:-1;}}
.gm-thumb{margin-left:auto;width:46px;height:46px;border:1px dashed var(--rule);background:transparent;
      font:inherit;font-size:8.5px;color:var(--ink2);cursor:pointer;padding:0;overflow:hidden;border-radius:0;}
.gm-thumb img{width:100%;height:100%;object-fit:cover;filter:grayscale(.35);display:block;}
.gm-thumb:hover{border-color:var(--assay);color:var(--assay);}
.gm-qrow{border-top:1px solid var(--grid);padding:12px 0 4px;}
.gm-qrow p{margin:0;font-size:12.5px;}
.gm-qrow p b{color:var(--ink2);font-size:9px;letter-spacing:.18em;margin-right:9px;font-weight:400;}
.gm-qrow .gm-row{padding:8px 0 0;}
.gm-row{display:flex;align-items:center;flex-wrap:wrap;gap:5px 15px;padding:12px 0 3px;}
.gm-row>b{font-size:9px;letter-spacing:.2em;color:var(--ink2);font-weight:400;flex:0 0 34px;}
.gm-chk{display:inline-flex;align-items:center;gap:6px;background:transparent;border:none;
      font:inherit;font-size:12px;color:var(--ink2);cursor:pointer;padding:2px 0;border-radius:0;}
.gm-chk i{width:11px;height:11px;border:1px solid var(--ink2);display:block;flex:0 0 11px;}
.gm-chk:hover{color:var(--ink);}
.gm-chk[data-on="1"]{color:var(--ink);}
.gm-chk[data-on="1"] i{background:var(--ink);border-color:var(--ink);box-shadow:inset 0 0 0 2px var(--form);}

.gm-go{width:100%;background:var(--ink);color:var(--form);border:none;padding:17px;
      font:inherit;font-size:13px;letter-spacing:.28em;cursor:pointer;border-radius:0;}
.gm-go:hover{background:var(--assay);}
.gm-go:disabled{background:var(--rule);cursor:not-allowed;}
.gm-note{font-size:10px;color:var(--ink2);text-align:center;margin-top:11px;line-height:1.7;}

/* results */
.gm-subj{border:1px solid var(--rule);padding:15px 16px;margin-bottom:14px;}
.gm-subj-hd{display:flex;gap:15px;align-items:flex-start;}
.gm-photo{width:86px;height:108px;object-fit:contain;flex:0 0 86px;
      border:1px solid var(--rule);filter:grayscale(.42) contrast(1.06);display:block;}
.gm-scent{margin-top:14px;border-top:1px dotted var(--rule);padding-top:12px;}
.gm-scent-hd{display:flex;align-items:baseline;gap:10px;margin-bottom:10px;}
.gm-scent-hd>span{font-size:9px;letter-spacing:.2em;color:var(--ink2);}
.gm-scent-hd>b{font-size:13px;}
.gm-notes{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--grid);
      border:1px solid var(--grid);}
.gm-notes>div{background:var(--form);padding:9px 10px;}
.gm-notes span{display:block;font-size:8px;letter-spacing:.22em;color:var(--ink2);margin-bottom:5px;}
.gm-notes p{margin:0;font-size:12px;line-height:1.6;}
@media(max-width:540px){.gm-notes{grid-template-columns:1fr;}}
.gm-scent-ft{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:10px 0 0;font-size:10.5px;color:var(--ink2);}
.gm-trigger{margin:8px 0 0;font-size:11.5px;color:var(--ink2);line-height:1.7;}
.gm-scentnote{margin:14px 0 0;font-size:15px;line-height:1.9;letter-spacing:-.01em;
      border-top:1px solid var(--grid);padding-top:13px;}
.gm-imprint{font-size:31px;line-height:1.55;font-weight:700;letter-spacing:-.03em;margin:4px 0 0;}
.gm-imprint em{font-style:normal;color:var(--seal);border-bottom:2px solid var(--seal);padding-bottom:1px;}
.gm-meaning{margin:13px 0 0;font-size:13.5px;line-height:1.9;color:var(--ink2);}
.gm-impmeta{display:flex;gap:30px;flex-wrap:wrap;margin-top:17px;padding-top:13px;
      border-top:1px solid var(--grid);font-size:12.5px;}
.gm-impmeta span{display:block;font-size:9px;letter-spacing:.18em;color:var(--ink2);margin-bottom:4px;}
.gm-subj h4{margin:0 0 3px;font-size:15px;font-weight:700;}
.gm-gradeline{display:flex;align-items:baseline;gap:9px;margin:10px 0 12px;}
.gm-grade{font-size:30px;font-weight:800;letter-spacing:-.03em;line-height:1;}
.gm-role{font-size:19px;font-weight:700;letter-spacing:-.01em;color:var(--assay);}
.gm-code{font-size:10px;color:var(--ink2);letter-spacing:.16em;}
.gm-conf{margin-left:auto;font-size:10px;color:var(--ink2);}
.gm-kv{display:grid;grid-template-columns:70px 1fr;gap:5px 12px;font-size:11.5px;}
.gm-kv dt{color:var(--ink2);font-size:9px;letter-spacing:.14em;padding-top:2px;}
.gm-kv dd{margin:0;}
.gm-ev{margin:11px 0 0;padding:9px 0 0;border-top:1px dotted var(--rule);list-style:none;}
.gm-ev li{font-size:11.5px;line-height:1.65;padding-left:14px;position:relative;color:var(--ink2);}
.gm-ev li:before{content:'―';position:absolute;left:0;}

.gm-big{display:flex;gap:30px;flex-wrap:wrap;align-items:flex-end;margin:4px 0 20px;}
.gm-big div span{display:block;font-size:9px;letter-spacing:.2em;color:var(--ink2);margin-bottom:4px;}
.gm-big div b{font-size:42px;font-weight:600;letter-spacing:-.04em;line-height:.9;}
.gm-big div b i{font-style:normal;font-size:15px;color:var(--ink2);}
.gm-type{margin-left:auto;text-align:right;}
.gm-type strong{font-size:19px;font-weight:800;display:block;}

.gm-metric{display:flex;align-items:center;gap:12px;padding:7px 0;border-top:1px solid var(--grid);}
.gm-metric span{font-size:11.5px;flex:1;}
.gm-cells{display:flex;gap:3px;}
.gm-cells i{width:15px;height:9px;border:1px solid var(--rule);display:block;}
.gm-cells i[data-on="1"]{background:var(--assay);border-color:var(--assay);}
.gm-cells em{font-style:normal;font-size:10px;color:var(--ink2);width:24px;text-align:right;}

.gm-caution{margin-top:14px;border-left:3px solid var(--seal);padding:9px 0 9px 13px;
      font-size:11.5px;line-height:1.7;color:var(--ink2);}

/* imprint */
/* prognosis + note */
.gm-ph{border-top:1px solid var(--grid);padding:12px 0;display:grid;
      grid-template-columns:78px 1fr;gap:16px;}
.gm-ph b{font-size:9px;letter-spacing:.16em;color:var(--ink2);font-weight:400;padding-top:3px;}
.gm-ph p{margin:0;font-size:13px;line-height:1.85;}
.gm-protocol{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px;}
.gm-protocol>div{border:1px solid var(--grid);padding:12px 13px;background:var(--form);}
.gm-protocol span{display:block;font-size:8.5px;letter-spacing:.2em;color:var(--ink2);margin-bottom:6px;}
.gm-protocol b{display:block;font-size:13px;margin-bottom:6px;}
.gm-protocol p{margin:0;font-size:12.5px;line-height:1.75;color:var(--ink2);}
@media(max-width:640px){.gm-protocol{grid-template-columns:1fr;}}
.gm-examiner{background:var(--paper);padding:19px 21px;position:relative;}
.gm-examiner p{margin:0;font-size:15px;line-height:2.05;letter-spacing:-.01em;}
.gm-sign{display:flex;justify-content:flex-end;align-items:center;gap:13px;margin-top:16px;}
.gm-seal{width:56px;height:56px;border:2px solid var(--seal);border-radius:50%;color:var(--seal);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      transform:rotate(-11deg);opacity:.82;line-height:1.15;flex:0 0 auto;}
.gm-seal b{font-size:11px;font-weight:800;} .gm-seal i{font-style:normal;font-size:6.5px;letter-spacing:.1em;}

.gm-ft{padding:16px 26px 20px;font-size:10px;color:var(--ink2);line-height:1.85;
      border-top:2px solid var(--ink);}
.gm-again{background:transparent;border:1px solid var(--ink);color:var(--ink);padding:9px 20px;
      font:inherit;font-size:11px;letter-spacing:.2em;cursor:pointer;border-radius:0;margin-top:13px;}
.gm-again:hover{background:var(--ink);color:var(--form);}
.gm-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:13px;}
.gm-actions .gm-again{margin-top:0;}

/* loading */
.gm-load{padding:80px 26px;text-align:center;}
.gm-load p{font-size:12px;letter-spacing:.22em;color:var(--ink2);margin:0 0 22px;}
.gm-track{height:3px;background:var(--grid);max-width:340px;margin:0 auto;overflow:hidden;}
.gm-track i{display:block;height:100%;background:var(--assay);width:34%;
      animation:gmrun 1.15s ease-in-out infinite;}
@keyframes gmrun{0%{transform:translateX(-105%)}100%{transform:translateX(320%)}}
.gm-err{color:var(--seal);font-size:12px;line-height:1.8;}
.gm-reject{border-left:3px solid var(--seal);padding:12px 0 12px 15px;margin-bottom:6px;}
.gm-reject p{margin:0;font-size:13px;line-height:1.95;white-space:pre-wrap;}
.gm-fade{animation:gmfade .5s ease both;}
@keyframes gmfade{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
.gm-pulse{animation:gmpulse 1.9s ease-in-out infinite;transform-origin:center;}
@keyframes gmpulse{0%,100%{opacity:.28;r:15}50%{opacity:.9;r:11}}
@media(prefers-reduced-motion:reduce){.gm-track i,.gm-fade,.gm-pulse{animation:none;}}
@media print{.gm{background:#fff;padding:0;}.gm-sheet{box-shadow:none;}.gm-again{display:none;}}

/* ── 고도화 ── */
.gm{--sealL:#D8737C;font-variant-numeric:tabular-nums;
    background:
      radial-gradient(circle at 18% 12%,rgba(255,255,255,.55),transparent 42%),
      radial-gradient(circle at 82% 78%,rgba(44,86,72,.07),transparent 46%),
      var(--paper);}
.gm-sheet{position:relative;box-shadow:0 1px 0 rgba(21,24,20,.06),6px 7px 0 rgba(21,24,20,.10);}
.gm-sheet:before{content:'';position:absolute;top:0;bottom:0;left:30px;width:1px;
    background:var(--seal);opacity:.16;pointer-events:none;}
@media(max-width:640px){.gm-sheet:before{display:none;}}

/* 헤더 */
.gm-hd{padding:24px 26px 18px 26px;}
.gm-brand{display:flex;align-items:center;gap:11px;color:var(--ink2);}
.gm-emblem{width:26px;height:26px;flex:0 0 26px;opacity:.9;}
.gm-title{font-size:29px;margin:12px 0 3px;}
.gm-bars{opacity:.82;}
.gm-meta{border:1px solid var(--rule);border-bottom:none;margin-top:18px;gap:0;}
.gm-meta div{padding:9px 11px;border-bottom:1px solid var(--rule);border-right:1px solid var(--rule);}
.gm-meta div:last-child{border-right:none;}
.gm-meta span{font-size:8px;}

/* 섹션 헤더 */
.gm-sec{padding:26px 26px 30px 26px;}
@media(min-width:760px){.gm-sec,.gm-hd,.gm-ft{padding-left:56px;}}
.gm-num{margin-bottom:20px;}
.gm-num:before{flex:0 0 18px;background:var(--seal);height:2px;opacity:.7;}
.gm-num b{font-size:14px;letter-spacing:.02em;}

/* 게이지 */
.gm-big{gap:26px;align-items:center;margin:0 0 22px;}
.gm-gauge{position:relative;width:106px;height:106px;flex:0 0 106px;}
.gm-gauge svg{width:100%;height:100%;display:block;}
.gm-gauge-c{position:absolute;inset:0;display:flex;flex-direction:column;
    align-items:center;justify-content:center;line-height:1;}
.gm-gauge-c b{font-size:31px;font-weight:600;letter-spacing:-.05em;}
.gm-gauge-c span{font-size:8.5px;letter-spacing:.16em;color:var(--ink2);margin-top:6px;}
.gm-type{margin-left:auto;text-align:right;}
.gm-type>span{display:block;font-size:8.5px;letter-spacing:.2em;color:var(--ink2);margin-bottom:5px;}
.gm-type strong{font-size:26px;letter-spacing:-.03em;}

.gm-modepick{padding-bottom:14px;border-bottom:1px solid var(--grid);margin-bottom:4px;}
.gm-modepick .gm-chk{font-size:13px;}

.gm-hist{margin-top:18px;border:1px solid var(--rule);padding:13px 15px;}
.gm-hist>span{font-size:9px;letter-spacing:.18em;color:var(--ink2);display:block;margin-bottom:5px;}
.gm-hist>b{font-size:16px;font-weight:700;}
.gm-hist>p{margin:8px 0 0;font-size:12px;line-height:1.75;color:var(--ink2);}

.gm-gate{padding-top:34px;padding-bottom:40px;}
.gm-gate-msg{font-size:13px;line-height:2;color:var(--ink2);margin:0 0 22px;}
.gm-gate-row{display:flex;gap:12px;align-items:flex-end;max-width:420px;}
.gm-gate-row .gm-in{flex:1;letter-spacing:.18em;}
.gm-gate-btn{background:var(--ink);color:var(--form);border:none;padding:11px 24px;
    font:inherit;font-size:12px;letter-spacing:.24em;cursor:pointer;border-radius:0;flex:0 0 auto;}
.gm-gate-btn:hover{background:var(--assay);}
.gm-gate-btn:disabled{opacity:.48;cursor:not-allowed;}
.gm-auth{display:flex;align-items:center;justify-content:space-between;gap:18px;}
.gm-auth .gm-num{margin-bottom:8px;}
.gm-auth-msg{margin:0;font-size:12.5px;line-height:1.8;color:var(--ink2);}
.gm-pass-msg{margin:7px 0 0;font-size:12px;line-height:1.7;color:var(--assay);}
.gm-auth-actions{display:flex;align-items:center;gap:10px;flex:0 0 auto;}
.gm-auth-pill{border:1px solid var(--assay);color:var(--assay);padding:8px 12px;
    font-size:10px;letter-spacing:.18em;white-space:nowrap;}
@media(max-width:640px){.gm-auth{display:block}.gm-auth-actions{margin-top:13px;justify-content:flex-start;flex-wrap:wrap;}}

/* 분류 명칭 · 희소도 */
.gm-codename{display:flex;flex-wrap:wrap;gap:18px 34px;align-items:flex-end;
    border:1px solid var(--rule);padding:15px 17px;margin-bottom:20px;}
.gm-codename span{display:block;font-size:8.5px;letter-spacing:.2em;color:var(--ink2);margin-bottom:6px;}
.gm-codename b{font-size:23px;font-weight:800;letter-spacing:-.02em;line-height:1.2;display:block;}
.gm-rarity{margin-left:auto;text-align:right;}
.gm-rarity b{font-size:13px;font-weight:500;letter-spacing:0;}
.gm-rarity em{font-style:normal;display:block;font-size:11px;color:var(--seal);margin-top:5px;
    letter-spacing:.04em;}
.gm-scentcode{font-style:normal;font-size:10px;letter-spacing:.1em;color:var(--ink2);
    margin-left:auto;flex:0 0 auto;}

/* 대조군 소견 */
.gm-cf b{color:var(--seal);opacity:.85;}
.gm-cf p{color:var(--ink2);}

/* 경고 · 공유 */
.gm-closing{margin-top:22px;}
.gm-warning{margin:0 0 16px;font-size:12px;line-height:1.85;color:var(--ink2);
    border:1px solid var(--seal);border-left-width:4px;padding:12px 15px;}
.gm-warning b{display:block;font-size:8.5px;letter-spacing:.24em;color:var(--seal);margin-bottom:6px;}
.gm-oneline{display:flex;align-items:center;gap:14px;background:var(--paper);padding:16px 18px;}
.gm-oneline p{margin:0;flex:1;font-size:16px;line-height:1.7;letter-spacing:-.01em;font-weight:700;}
.gm-oneline button{flex:0 0 auto;background:transparent;border:1px solid var(--ink);color:var(--ink);
    font:inherit;font-size:10px;letter-spacing:.18em;padding:7px 14px;cursor:pointer;border-radius:0;}
.gm-oneline button:hover{background:var(--ink);color:var(--form);}

/* 이미지 조정 */
.gm-adj{margin-left:auto;width:100%;max-width:240px;}
.gm-adj-wide{margin-left:0;width:100%;flex:none;}
.gm-adj-view{border:1px dashed var(--rule);overflow:hidden;position:relative;
    display:flex;align-items:center;justify-content:center;padding:0;text-align:center;
    font-size:9px;letter-spacing:.1em;color:var(--ink2);cursor:pointer;touch-action:none;}
.gm-adj-view:hover{border-color:var(--assay);}
.gm-adj-view img{width:100%;height:100%;object-fit:contain;display:block;cursor:grab;
    filter:grayscale(.4) contrast(1.06);user-select:none;-webkit-user-drag:none;
    transform-origin:50% 50%;will-change:transform;}
.gm-adj-view img:active{cursor:grabbing;}
.gm-adj-ctl{display:flex;justify-content:flex-end;gap:8px;padding-top:7px;}
.gm-adj-ctl button{background:none;border:none;font:inherit;font-size:9px;color:var(--ink2);
    cursor:pointer;padding:0;text-decoration:underline;flex:0 0 auto;border-radius:0;}
.gm-adj-ctl button:hover{color:var(--assay);}
.gm-adj-tip{position:absolute;left:8px;right:8px;bottom:8px;background:rgba(21,24,20,.78);
    color:var(--form);font-size:8px;letter-spacing:.16em;padding:5px 6px;text-align:center;}
.gm-crop-backdrop{position:fixed;inset:0;background:rgba(12,14,12,.72);z-index:20;
    display:flex;align-items:center;justify-content:center;padding:18px;}
.gm-crop-modal{width:min(620px,100%);background:var(--form);border:1px solid var(--ink);
    box-shadow:4px 4px 0 rgba(0,0,0,.28);padding:18px;}
.gm-crop-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}
.gm-crop-head b{font-size:12px;letter-spacing:.18em;}
.gm-crop-head button{background:none;border:none;font:inherit;font-size:18px;line-height:1;cursor:pointer;color:var(--ink);}
.gm-crop-stage{height:min(58vh,440px);border:1px solid var(--ink);background:#0f120f;
    overflow:hidden;position:relative;touch-action:none;cursor:grab;}
.gm-crop-stage:active{cursor:grabbing;}
.gm-crop-stage img{width:100%;height:100%;object-fit:contain;display:block;
    user-select:none;-webkit-user-drag:none;transform-origin:50% 50%;will-change:transform;}
.gm-crop-mask{position:absolute;inset:0;box-shadow:inset 0 0 0 999px rgba(0,0,0,.22);
    border:1px dashed rgba(252,252,248,.72);pointer-events:none;}
.gm-crop-ctl{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:center;margin-top:14px;}
.gm-crop-ctl span{font-size:9px;letter-spacing:.18em;color:var(--ink2);}
.gm-crop-ctl input{width:100%;accent-color:var(--assay);}
.gm-crop-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:15px;}
.gm-crop-actions button{background:transparent;border:1px solid var(--ink);font:inherit;font-size:11px;
    letter-spacing:.16em;padding:9px 15px;cursor:pointer;border-radius:0;color:var(--ink);}
.gm-crop-actions button[data-primary="1"]{background:var(--ink);color:var(--form);}
.gm-crop-actions button:hover{border-color:var(--assay);color:var(--assay);}
.gm-crop-actions button[data-primary="1"]:hover{background:var(--assay);color:var(--form);}
@media(max-width:540px){.gm-crop-modal{padding:14px}.gm-crop-stage{height:360px;}.gm-crop-ctl{grid-template-columns:1fr;}}
.gm-photo-wrap{width:86px;height:108px;flex:0 0 86px;border:1px solid var(--rule);overflow:hidden;background:#f1f2ec;}
.gm-photo-wrap img{width:100%;height:100%;object-fit:contain;display:block;
    filter:grayscale(.45) contrast(1.08) brightness(1.02);}
.gm-specimens{margin:0 0 18px;border:1px solid var(--rule);background:var(--form);padding:10px;
    position:relative;}
.gm-specimens:before,.gm-specimens:after{content:'';position:absolute;top:9px;width:34px;height:9px;
    background:rgba(178,103,111,.42);mix-blend-mode:multiply;transform:rotate(-4deg);}
.gm-specimens:before{left:12px;}
.gm-specimens:after{right:12px;transform:rotate(4deg);}
.gm-specimens-head{display:flex;justify-content:space-between;gap:12px;align-items:baseline;
    padding:8px 6px 10px;border-bottom:1px solid var(--grid);}
.gm-specimens-head b{font-size:9px;letter-spacing:.22em;color:var(--ink);}
.gm-specimens-head span{font-size:9px;letter-spacing:.13em;color:var(--ink2);text-align:right;}
.gm-specimens-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding-top:12px;}
.gm-specimens-joint .gm-specimens-grid{grid-template-columns:1fr;}
.gm-specimen{border:1px solid var(--grid);background:var(--form);position:relative;box-shadow:2px 2px 0 rgba(21,24,20,.08);}
.gm-specimen-strip{height:22px;background:var(--ink);color:var(--form);display:flex;align-items:center;
    justify-content:space-between;padding:0 10px;font-size:8px;letter-spacing:.16em;}
.gm-specimen-strip b{font-size:9px;letter-spacing:.18em;}
.gm-specimen-body{display:grid;grid-template-columns:96px minmax(0,1fr);gap:13px;padding:13px;
    background:linear-gradient(180deg,rgba(255,255,255,.28),transparent);}
.gm-specimens-joint .gm-specimen-body{grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);}
.gm-specimen-photo{height:138px;border:1px solid var(--grid);background:#dde0d8;overflow:hidden;position:relative;}
.gm-specimens-joint .gm-specimen-photo{height:230px;}
.gm-specimen-photo:after{content:'';position:absolute;inset:0;border:8px solid rgba(252,252,248,.36);pointer-events:none;}
.gm-specimen-photo img{width:100%;height:100%;object-fit:contain;display:block;
    filter:grayscale(.34) contrast(1.08) brightness(.98);transform-origin:50% 50%;}
.gm-specimen-profile{min-width:0;display:flex;flex-direction:column;gap:10px;}
.gm-specimen-name{display:inline-block;align-self:flex-start;min-width:72px;max-width:100%;
    border:1px solid var(--ink2);padding:4px 9px;font-size:12px;font-weight:700;overflow-wrap:anywhere;}
.gm-specimen-profile table{width:100%;border-collapse:collapse;font-size:10.5px;}
.gm-specimen-profile th,.gm-specimen-profile td{border:1px solid var(--grid);padding:5px 7px;text-align:left;vertical-align:top;}
.gm-specimen-profile th{width:54px;color:var(--ink2);font-size:8px;letter-spacing:.12em;font-weight:700;}
.gm-specimen-lines{border-top:1px dotted var(--grid);padding-top:8px;margin-top:auto;}
.gm-specimen-lines p{margin:0 0 5px;font-size:10.5px;line-height:1.55;color:var(--ink2);}
.gm-specimen-lines p:before{content:'— ';}
.gm-specimen-row{display:grid;grid-template-columns:22px minmax(0,1fr);gap:3px 8px;border-bottom:1px solid var(--grid);padding:8px 0;}
.gm-specimen-row span{grid-row:1 / span 2;background:var(--ink);color:var(--form);height:22px;display:grid;place-items:center;font-size:9px;}
.gm-specimen-row b{font-size:13px;overflow-wrap:anywhere;}
.gm-specimen-row i{font-style:normal;font-size:10px;color:var(--ink2);}
.gm-pairfig-view{height:300px;overflow:hidden;background:#f1f2ec;}
.gm-pairfig-view img{width:100%;height:100%;object-fit:contain;display:block;
    filter:grayscale(.45) contrast(1.08);}

/* 이미지 모드 */
.gm-imgmode{padding-bottom:14px;border-bottom:1px solid var(--grid);margin-bottom:4px;}
.gm-pairbox{padding:14px 0 4px;}
.gm-pairdrop{width:100%;height:150px;border:1px dashed var(--rule);background:transparent;
    font:inherit;font-size:10.5px;letter-spacing:.12em;color:var(--ink2);cursor:pointer;
    padding:0;overflow:hidden;border-radius:0;display:block;}
.gm-pairdrop:hover{border-color:var(--assay);color:var(--assay);}
.gm-pairdrop img{width:100%;height:100%;object-fit:contain;filter:grayscale(.35);display:block;}
.gm-pairfig{margin:0 0 18px;border:1px solid var(--rule);padding:7px;}
.gm-pairfig img{width:100%;max-height:300px;object-fit:contain;display:block;
    filter:grayscale(.45) contrast(1.08);}
.gm-pairfig figcaption{font-size:9px;letter-spacing:.16em;color:var(--ink2);padding:8px 2px 2px;}

/* 개체 카드 */
.gm-subj{padding:18px 19px;border-color:var(--rule);position:relative;}
.gm-subj:before{content:'';position:absolute;top:-1px;left:-1px;width:16px;height:16px;
    border-top:2px solid var(--ink);border-left:2px solid var(--ink);}
.gm-grade{font-size:32px;}
.gm-photo{filter:grayscale(.45) contrast(1.08) brightness(1.02);}

/* 각인 반전 패널 */
.gm-imp-panel{background:var(--ink);color:var(--form);padding:34px 30px 30px;
    margin:0 -19px 2px;position:relative;overflow:hidden;}
@media(min-width:760px){.gm-imp-panel{margin:0 -30px 2px;padding:40px 42px 34px;}}
.gm-imp-panel:after{content:'';position:absolute;right:-40px;top:-40px;width:150px;height:150px;
    border:1px solid rgba(252,252,248,.14);border-radius:50%;}
.gm-imp-panel .gm-imprint{color:var(--form);font-size:33px;line-height:1.6;margin:0;}
.gm-imp-panel .gm-imprint em{color:var(--sealL);border-bottom-color:var(--sealL);}
.gm-imp-panel .gm-meaning{color:rgba(252,252,248,.62);margin-top:18px;font-size:13px;
    border-top:1px solid rgba(252,252,248,.16);padding-top:15px;max-width:34em;}
@media(max-width:540px){.gm-imp-panel .gm-imprint{font-size:25px;}}

/* 향 노트 */
.gm-notes>div{padding:11px 12px 13px;}
.gm-notes p{font-size:12.5px;}
.gm-scentnote{font-size:16px;}

/* 소견란 */
.gm-examiner{border:1px solid var(--rule);padding:24px 26px;}
.gm-examiner:before{content:'';display:block;width:34px;height:1px;background:var(--seal);
    opacity:.7;margin-bottom:15px;}
.gm-examiner p{font-size:16px;line-height:2.1;}
.gm-seal{width:60px;height:60px;}

/* 절취선·푸터 */
.gm-cut{height:0;border-top:1px dashed var(--rule);margin:0 26px;opacity:.8;}
.gm-ft{border-top:none;padding-top:18px;}

/* 순차 등장 */
.gm-fade>.gm-sec{animation:gmfade .55s ease both;}
.gm-fade>.gm-sec:nth-child(2){animation-delay:.09s;}
.gm-fade>.gm-sec:nth-child(3){animation-delay:.18s;}
.gm-fade>.gm-sec:nth-child(4){animation-delay:.27s;}
.gm-fade>.gm-sec:nth-child(5){animation-delay:.36s;}
@media(prefers-reduced-motion:reduce){.gm-fade>.gm-sec{animation:none;}}
@media print{.gm-imp-panel{background:#fff;color:#000;border:1px solid #000;}
    .gm-imp-panel .gm-imprint{color:#000;}.gm-sheet:before{display:none;}}

/* ── 에셋 적용 ── */
.gm{background-color:var(--paper);
    background-image:
      radial-gradient(circle at 18% 10%,rgba(255,255,255,.5),transparent 44%),
      radial-gradient(circle at 84% 82%,rgba(44,86,72,.06),transparent 46%),
      url(${ASSETS.paper});
    background-size:auto,auto,384px;
    background-repeat:no-repeat,no-repeat,repeat;}
.gm-sheet{background-color:var(--form);
    background-image:url(${ASSETS.paper});
    background-size:384px;background-blend-mode:soft-light;}
.gm-imp-panel{background-color:#0F120F;
    background-image:url(${ASSETS.pattern});
    background-size:cover;background-position:center;}
.gm-imp-panel:after{display:none;}
.gm-seal{border:none;opacity:1;width:68px;height:68px;
    background:url(${ASSETS.stamp}) center/contain no-repeat;transform:rotate(-9deg);}
.gm-seal b{font-size:12px;} .gm-seal i{font-size:6px;}
.gm-scent-icon{width:30px;height:30px;flex:0 0 30px;opacity:.88;display:block;}
@media(max-width:600px){
  .gm{padding:0 0 44px;background-size:auto,auto,300px;}
  .gm-sheet{width:100%;border-left:none;border-right:none;box-shadow:none;overflow:hidden;}
  .gm-hd{padding:18px 18px 15px;}
  .gm-brand{gap:9px;}
  .gm-emblem{width:23px;height:23px;flex-basis:23px;}
  .gm-inst{font-size:8px;letter-spacing:.2em;}
  .gm-title{font-size:22px;line-height:1.36;letter-spacing:0;margin-top:11px;}
  .gm-sub{font-size:10px;line-height:1.6;letter-spacing:.04em;}
  .gm-bars{height:16px;margin-top:12px;}
  .gm-meta{grid-template-columns:repeat(2,minmax(0,1fr));margin-top:14px;}
  .gm-meta div{padding:8px 9px;min-width:0;overflow-wrap:anywhere;}

  .gm-sec{padding:22px 18px 26px;}
  .gm-num{gap:8px;flex-wrap:wrap;margin-bottom:17px;}
  .gm-num:before{flex-basis:16px;}
  .gm-num b{font-size:14px;letter-spacing:0;}
  .gm-num em{font-size:8px;letter-spacing:.18em;}

  .gm-grid2{gap:18px;}
  .gm-ta{min-height:132px;font-size:13px;}
  .gm-row{gap:8px 13px;align-items:flex-start;}
  .gm-row>b{flex:0 0 100%;}
  .gm-chk{min-height:28px;font-size:12.5px;}
  .gm-opt{font-size:12px;padding:6px 10px;}
  .gm-go{padding:16px 14px;font-size:13px;}
  .gm-note{font-size:11px;padding:0 8px;}
  .gm-gate-row{display:block;}
  .gm-gate-row .gm-gate-btn{width:100%;margin-top:12px;}
  .gm-auth-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  .gm-auth-actions .gm-gate-btn,.gm-auth-pill{width:100%;text-align:center;padding:10px 8px;}

  .gm-codename{display:block;padding:15px 14px;margin-bottom:16px;}
  .gm-codename b{font-size:28px;line-height:1.15;letter-spacing:0;overflow-wrap:anywhere;}
  .gm-rarity{margin:16px 0 0;text-align:left;border-top:1px solid var(--grid);padding-top:12px;}
  .gm-rarity b{font-size:12.5px;line-height:1.6;}

  .gm-subj{padding:16px 14px;margin-bottom:12px;}
  .gm-subj-hd{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;}
  .gm-photo-wrap{width:100%;height:188px;flex-basis:auto;}
  .gm-specimens{padding:8px;margin-bottom:16px;}
  .gm-specimens:before,.gm-specimens:after{width:26px;height:8px;top:10px;}
  .gm-specimens-head{display:block;padding:8px 5px 9px;}
  .gm-specimens-head span{display:block;text-align:left;margin-top:5px;line-height:1.5;}
  .gm-specimens-grid{grid-template-columns:1fr;gap:10px;}
  .gm-specimen-body,.gm-specimens-joint .gm-specimen-body{grid-template-columns:92px minmax(0,1fr);gap:10px;padding:11px;}
  .gm-specimen-photo,.gm-specimens-joint .gm-specimen-photo{height:132px;}
  .gm-specimen-profile table{font-size:10px;}
  .gm-specimen-profile th,.gm-specimen-profile td{padding:5px 6px;}
  .gm-specimen-lines p{font-size:10px;}
  .gm-gradeline{display:grid;grid-template-columns:auto auto 1fr;gap:8px 10px;align-items:end;margin:9px 0 12px;}
  .gm-grade{font-size:38px;letter-spacing:0;}
  .gm-role{font-size:22px;letter-spacing:0;}
  .gm-code{font-size:10px;align-self:center;overflow-wrap:anywhere;}
  .gm-conf{grid-column:1 / -1;margin-left:0;font-size:11px;}
  .gm-kv{grid-template-columns:58px minmax(0,1fr);gap:6px 10px;}
  .gm-kv dd,.gm-ev li,.gm-trigger,.gm-caution{font-size:12.5px;line-height:1.8;}

  .gm-scent-hd{display:grid;grid-template-columns:auto 1fr;gap:8px 10px;align-items:center;}
  .gm-scent-hd>span{grid-column:2;font-size:8px;}
  .gm-scent-hd>b{grid-column:2;font-size:15px;line-height:1.4;}
  .gm-scentcode{grid-column:1 / -1;margin-left:0;}
  .gm-notes{grid-template-columns:1fr;}
  .gm-notes>div{padding:12px;}
  .gm-notes p{font-size:13px;line-height:1.75;}
  .gm-scent-ft{gap:8px 12px;font-size:11px;}
  .gm-scentnote{font-size:15px;line-height:1.85;}

  .gm-big{display:grid;grid-template-columns:auto minmax(0,1fr);gap:16px;margin-bottom:18px;}
  .gm-gauge{width:92px;height:92px;flex-basis:92px;}
  .gm-gauge-c b{font-size:27px;}
  .gm-type{text-align:left;margin-left:0;}
  .gm-type strong{font-size:21px;line-height:1.35;}

  .gm-metric{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;}
  .gm-cells{align-items:center;}
  .gm-cells i{width:18px;height:10px;}
  .gm-hist{padding:14px;margin-top:16px;}
  .gm-hist>b{font-size:17px;line-height:1.5;}
  .gm-hist>p{font-size:12.5px;line-height:1.85;}

  .gm-imp-panel{margin:0 -18px 4px;padding:28px 24px;}
  .gm-imp-panel .gm-imprint{font-size:28px;line-height:1.55;letter-spacing:0;}
  .gm-imp-panel .gm-meaning{font-size:12.5px;line-height:1.85;}
  .gm-impmeta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px;}
  .gm-impmeta div{min-width:0;overflow-wrap:anywhere;font-size:12px;}

  .gm-ph{grid-template-columns:1fr;gap:8px;padding:14px 0;}
  .gm-ph b{font-size:9px;padding-top:0;}
  .gm-ph p{font-size:14px;line-height:1.85;}
  .gm-protocol{gap:10px;}
  .gm-protocol p{font-size:12.5px;}
  .gm-examiner{padding:20px 18px;}
  .gm-examiner p{font-size:15px;line-height:2;}
  .gm-sign{justify-content:space-between;gap:10px;}
  .gm-seal{width:58px;height:58px;flex-basis:58px;}
  .gm-oneline{display:block;padding:15px;}
  .gm-oneline p{font-size:15px;line-height:1.75;}
  .gm-oneline button{margin-top:12px;width:100%;}

  .gm-ft{padding:17px 18px 22px;font-size:10.5px;}
  .gm-actions{display:grid;grid-template-columns:1fr;gap:9px;}
  .gm-actions .gm-again{width:100%;padding:12px 10px;}
  .gm-again:disabled{opacity:.55;cursor:wait;}
  .gm-pairfig-view{height:220px;}
  .gm-pairfig img{max-height:220px;}
}
@media print{.gm{background-image:none;}.gm-sheet{background-image:none;}}
`;

/* ── 각인 부위 ── */
