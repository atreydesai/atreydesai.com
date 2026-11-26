<script lang="ts">
  import { neighborhoodLight } from "#lib/arcade/orders-station-art.ts";

  interface Props {
    branch: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    weather?: string;
    daylight?: number;
    active?: boolean;
    renovated?: boolean;
  }

  let { branch, x = 0, y = 0, width = 800, height = 188, weather = "neighborhood", daylight = 0, active = true, renovated = false }: Props = $props();
  const light = $derived(neighborhoodLight(branch, weather, daylight));
  const night = $derived(light === "night");
  const rain = $derived(light === "rain");
  const sky = $derived(rain ? "#92929b" : night ? "#796a82" : branch === "harbor" ? "#c4ac9e" : "#d3a78f");
  const skyline = $derived(rain ? "#767882" : night ? "#5e586c" : "#9a827d");
  const sidewalk = $derived(rain ? "#949084" : night ? "#928579" : "#b0a08a");
  const lanternWalk = [[211, 35], [266, 45], [328, 50], [397, 52], [466, 47], [535, 41], [592, 31]];
  const paving = [27, 119, 230, 356, 579, 683, 782];
  const rainMarks = [[29,20], [73,41], [119,17], [187,57], [235,29], [288,9], [368,49], [408,31], [468,14], [529,54], [581,21], [676,49], [714,14], [764,23]];
</script>

{#snippet planter(px: number, py: number)}
  <g transform="translate({px} {py})">
    <path d="M-12 0h24l-3 11H-9z" fill="#82675a" />
    <path d="M-11 1h22v3h-22z" fill="#bd8e70" />
    <path d="M-2 0v-7h-4v-4h-5v-4h7v4h5v5h3v-8h8v4H8v5H4v5z" fill="#70876d" />
    <path d="M-8-14h3v2h-3zm16 1h4v2H8z" fill="#a7a477" />
  </g>
{/snippet}

{#snippet lantern(px: number, py: number)}
  <g transform="translate({px} {py})">
    <path d="M-1-8h2v7h-2zm-6 7H7v3h3v11H7v3H-7v-3h-3V2h3zm6 17h2v5h-2z" fill="#8b5551" />
    <path d="M-5 1H5v3h3v7H5v3H-5v-3h-3V4h3z" fill="#c78361" />
    <path d="M-3 2h6v11h-6z" fill="#f2bc80" />
  </g>
{/snippet}

{#snippet marketStall(px: number, awning: string)}
  <g transform="translate({px} 144)" opacity=".92">
    <path d="M-46 0l12-5h69l13 5-13 5h-69z" fill="#877969" opacity=".61" />
    <path d="M-33-57h5v58h-5zm61 0h5v58h-5z" fill="#785f55" />
    <path d="M-39-60l7-12h64l10 12v7h-81z" fill="#765752" />
    <path d="M-36-60l7-9h59l8 9z" fill={awning} />
    <path d="M-32-57h13v7h-13zm27 0H8v7H-5zm27 0h13v7H22z" fill="#e1bc8c" />
    <path class="market-valance" d="M-19-57h14v9h-14zM8-57h14v9H8z" fill={awning} />
    <path d="M-32-29h64v27h-64z" fill="#a67c62" />
    <path d="M-36-31h72v7h-72z" fill="#c09a74" />
    <path d="M-28-19h33v4h-33zm0 8h26v4h-26z" fill="#c59972" />
    <path d="M-27-31v-6h7v-6h7v5h7v7z" fill="#bd7a58" />
    <path d="M-19-41h4v3h-4z" fill="#e1ad6e" />
    <path d="M8-31v-8h22v8z" fill="#937752" />
    <path d="M10-38h5v5h-5zm6-5h7v10h-7zm8 4h5v6h-5z" fill="#a1a176" />
  </g>
{/snippet}

<svg class="neighborhood" class:still={!active} data-neighborhood={branch} data-renovated={renovated ? branch : undefined}
  {x} {y} {width} {height} viewBox="0 0 800 188"
  preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" overflow="hidden" aria-hidden="true" focusable="false">
  <path d="M0 0h800v188H0z" fill={sky} />
  <path d="M0 61h800v39H0z" fill="#bf9b91" opacity=".41" />
  {#if branch !== "harbor" && branch !== "loft"}
    <path d="M0 77h30V50h30v-9h32v16h24v24h39V64h33v9h26v15h64V52h49v12h14V47h39v40h95V65h29V48h38v18h21v14h39V62h31v10h29V49h39v13h32v14h28V58h39v66H0z" fill={skyline} />
    <path d="M66 54h14v3H66zm46 14h8v3h-8zm68 9h9v3h-9zm113-16h19v3h-19zm59-5h17v3h-17zm165 0h9v3h-9zm157 4h17v3h-17zm68 3h16v3h-16z" fill="#d7b49a" opacity=".65" />
  {/if}
  <path d="M0 106h800v82H0z" fill={sidewalk} />

  <path d="M0 145h800v43H0z" fill={sidewalk} />
  <path d="M0 146h800v3H0zm0 18h800v2H0z" fill="#d2b79a" opacity=".65" />
  <path d="M0 174h800v2H0z" fill="#938774" opacity=".56" />
  {#each paving as px}
    <path d="M{px} 147h3l24 41h-4z" fill="#908573" opacity=".58" />
  {/each}

  {#if branch === "campus"}
    <path d="M100 51h63V34h78V23h248v11h84v18h52v67H100z" fill="#805f5d" />
    <path d="M106 54h63V39h76V28h240v11h84v17h50v62H106z" fill="#b1806d" />
    <path d="M110 54h51v5h-51zm65-15h66v5h-66zm73-10h233v5H248zm239 12h78v4h-78zm85 15h43v4h-43z" fill="#d5a887" />
    <path d="M112 74h500M112 90h500M112 106h500" stroke="#946c62" stroke-width="2" />
    {#each [132, 184, 237, 487, 541, 591] as pane}
      <path d="M{pane} 67h26v35h-26z" fill="#765d58" />
      <path d="M{pane + 3} 70h20v25h-20z" fill="#768782" />
      <path d="M{pane + 4} 71h17v3h-17z" fill="#c4b298" />
      <path d="M{pane + 12} 71h2v24h-2z" fill="#a7a089" />
    {/each}
    <path d="M282 113V64l16-14h133l17 14v49z" fill="#e0b995" />
    <path d="M318 114V73l9-10h77l9 10v41z" fill="#655c57" />
    <path d="M329 75h72v31h-72z" fill="#82968a" />
    <path d="M363 75h5v32h-5z" fill="#b5ad94" />
    <path d="M274 112h181v5H274zm-13 7h207v5H261zm-11 7h230v4H250z" fill="#8f776a" />
    <path d="M12 86h69l11 9v9H4v-9z" fill="#a4a288" />
    <path d="M678 84h88l12 11v9H665v-9z" fill="#a58170" />
    <path d="M22 105h5v24h-5zm49 0h5v24h-5zm617 0h5v24h-5zm70 0h5v24h-5z" fill="#857164" />
    <path d="M61 144h120v4H61zm501-4h165v4H562z" fill="#bbae97" />
  {:else if branch === "garden"}
    <path d="M164 70l49-34h47l40-18h199l42 18h55l47 34v65H164z" fill="#667c70" />
    <path d="M173 70l43-29h47l39-18h195l41 18h55l41 29v57H173z" fill="#afba9d" />
    <path d="M303 26h193l30 18H275z" fill="#d8c4a6" />
    <path d="M182 74h447v47H182z" fill="#8ca28e" />
    <path d="M181 83h447v5H181zm63-39h5v80h-5zm64-18h5v98h-5zm122 0h5v98h-5zm62 0h5v98h-5zm58 18h5v80h-5z" fill="#708b79" />
    <path d="M357 127V73h52v54z" fill="#6e857a" />
    <path d="M363 76h40v49h-40z" fill="#bdc3a5" />
    <path d="M382 76h3v49h-3z" fill="#819687" />
    <path d="M0 128h258l-78 60H0zm594 0h206v60H655z" fill="#899477" />
    <path d="M314 129h133l70 59H242z" fill="#c9ae8e" />
    <path d="M283 155h190m-209 13h224" stroke="#ad987f" stroke-width="2" />
    {@render planter(55, 132)}
    {@render planter(114, 139)}
    {@render planter(650, 138)}
    {@render planter(729, 147)}
  {:else if branch === "night"}
    <path d="M0 89h800v31H0z" fill="#69616b" />
    <path d="M43 89h105l20 18v9H23v-9zm159-8h129l20 19v12H181v-12zm359 10h117l17 16v10H542v-10zm154-11h85v31H701V98z" fill="#775459" />
    <path d="M47 93h97l18 15H30zm159-9h122l16 17H187zm361 10h110l12 13H548zm155-11h78v17h-92z" fill="#bd7c66" />
    <path d="M37 115h122v20H37zm153-4h150v23H190zm366 5h126v19H556zm155-7h89v26h-89z" fill="#9a7569" />
    <path d="M51 120h96v8H51zm159-3h115v9H210zm360 5h94v6h-94zm155-7h68v10h-68z" fill="#cb9a71" />
    <path d="M6 24l142 20 96 4 98-10 92-17 103 11 112 12 151-15" fill="none" stroke="#76585f" stroke-width="2" />
    {@render lantern(69, 35)}
    {@render lantern(150, 44)}
    {@render lantern(251, 47)}
    {@render lantern(329, 40)}
    {@render lantern(588, 38)}
    {@render lantern(675, 42)}
    {@render lantern(749, 33)}
    <path d="M107 149h50v3h-50zm113 9h91v3h-91zm365-12h93v3h-93zm124 13h54v4h-54z" fill="#d4a27c" opacity=".58" />
  {:else if branch === "loft"}
    <path d="M0 12h197v5H0zm270 36h474v5H270z" fill="#a28b95" opacity=".52" />
    <g class="loft-cloud loft-cloud-high" fill="#c2a3ad" opacity=".45">
      <path d="M0 24h19v-4h24v-5h44v4h23v5h49v4H0z" />
      <path d="M27 30h91v2H27z" />
    </g>
    <g class="loft-cloud loft-cloud-low" fill="#aa929d" opacity=".56">
      <path d="M0 48h15v-4h35v-5h37v4h27v5h29v4H0z" />
      <path d="M17 54h69v2H17z" />
    </g>
    <path d="M0 99h22V77h33V63h29v13h48V51h60v11h22v25h74V70h18V47h54v19h32v18h68V62h31V40h43v19h39v23h38V69h51V54h65v17h22v12h28V61h23v49H0z" fill="#625f73" />
    <path d="M0 110h84V88h37v-9h31v10h31v18h49V77h53v12h15v21h66V96h58v9h42V84h23V72h61v14h27v22h54V93h47v-8h42v14h39v-8h41v37H0z" fill="#746d76" />
    <path d="M139 62h32v3h-32zm100 24h29v3h-29zm74-28h15v3h-15zm34 3h8v3h-8zm152-9h15v3h-15zm38 30h25v3h-25zm87-6h16v3h-16zm56-12h19v3h-19z" fill="#c39b88" opacity=".67" />
    <path d="M0 127h239l51-9h220l70 8h220v62H0z" fill="#837a76" />
    <path d="M0 130h239l51-8h220l70 7h220v6H578l-70-8H292l-53 8H0z" fill="#a89486" />
    <path d="M253 99l27-17h30l16-11h109l17 11h32l23 17v29H253z" fill="#5c6965" />
    <path d="M262 100l21-14h30l16-11h104l16 11h33l19 14v23H262z" fill="#8d9b89" />
    <path d="M332 78h98l12 8H320z" fill="#c1b29a" />
    <path d="M267 101h228v18H267z" fill="#d8af80" />
    <path d="M275 104h210v12H275z" fill="#e3c095" />
    <path d="M289 87h4v37h-4zm34-5h4v42h-4zm38-4h4v46h-4zm36 0h4v46h-4zm41 4h4v42h-4zm36 5h4v37h-4zM264 98h234v4H264z" fill="#748275" />
    <path d="M366 105h35v20h-35z" fill="#62796d" />
    <path d="M371 108h24v12h-24z" fill="#acc0a1" />
    <path d="M381 108h3v12h-3z" fill="#758678" />
    <path d="M0 152h172v-5h65v5h326v-5h63v5h174v5H0z" fill="#676563" />
    <path d="M0 153h800v3H0z" fill="#ac9989" />
    <path d="M0 157h800v31H0z" fill="#877873" />
    <path d="M28 171h145v2H28zm215-8h203v2H243zm258 16h179v2H501z" fill="#ad9588" />
  {:else if branch === "harbor"}
    <path d="M0 74h32l23-12h70l20 14h69l33 11h354l24-14h81l37-12h57v50H0z" fill={night ? "#625c70" : "#9c8a85"} />
    <path d="M0 94h800v49H0z" fill={rain ? "#818b8c" : night ? "#687983" : "#8c9e97"} />
    <path d="M0 95h800v3H0zm19 21h105v2H19zm142-9h117v3H161zm187 16h106v2H348zm161-17h140v2H509zm161 21h119v3H670z" fill="#c2b1a0" opacity=".7" />
    <path d="M643 66h9v30h-9zm-3 3h15v6h-15zm4-9h7v7h-7z" fill="#806a66" />
    <path d="M644 69h7v5h-7z" fill={night ? "#e8be88" : "#d6b399"} />
    <path d="M638 100h21v2h-21zm-6 6h34v2h-34zm8 6h20v2h-20zm-13 9h42v2h-42z" fill="#d8aa81" opacity={night ? .67 : .34} />
    <g class="branch-ferry">
      <path d="M-5 115h204v4H-5zm24 8h148v3H19z" fill="#b3af9c" opacity=".52" />
      <path d="M0 96h191l-15 16H17z" fill="#626361" />
      <path d="M7 98h177l-7 7H13z" fill="#a3766b" />
      <path d="M25 77h121l25 11v9H18v-10z" fill="#b5ab96" />
      <path d="M25 78h122l16 7H22z" fill="#d4c3a7" />
      <path d="M34 86h20v8H34zm26 0h19v8H60zm25 0h19v8H85zm25 0h19v8h-19zm25 0h15l11 8h-26z" fill={night ? "#e1bd87" : "#798b87"} />
      <path d="M59 71h34v6H59zm10-13h14v14H69z" fill="#857a71" />
      <path d="M73 59h9v3h-9z" fill="#b88d78" />
      {#if night}
        <path d="M38 117h103v2H38zm11 5h79v2H49zm12 5h18v2H61zm29 0h24v2H90z" fill="#dab28a" opacity=".66" />
      {/if}
    </g>
    <path d="M0 138h192l31-6h369l31 6h177v50H0z" fill="#a39180" />
    <path d="M0 142h196l29-6h365l34 6h176v3H621l-32-5H224l-27 5H0z" fill="#c1a98e" />
    <path d="M0 128h202l25-5h348l34 5h191v4H608l-35-5H226l-24 5H0z" fill="#756e64" />
    <path d="M0 134h204l25-5h348l34 5h189v2H610l-33-5H230l-26 5H0z" fill="#8f7a68" />
    {#each [20, 104, 191, 267, 346, 434, 523, 603, 688, 771] as post}
      <path d="M{post} {post >= 267 && post <= 523 ? 118 : 123}h5v24h-5z" fill="#72645a" />
    {/each}
    <path d="M61 160h162v3H61zm244-10h155v3H305zm232 16h194v3H537z" fill="#bca58b" opacity=".64" />
  {:else if branch === "station"}
    <path d="M38 72l92-34h527l110 34v8H38z" fill="#6d706b" />
    <path d="M47 70l85-29h523l101 29z" fill="#a6a393" />
    <path d="M47 72h709v5H47zM94 77h7v54h-7zm136 0h7v54h-7zm329 0h7v54h-7zm137 0h7v54h-7z" fill="#737b73" />
    <path d="M0 113h800v13H0z" fill="#656765" />
    <path d="M0 116h800v3H0z" fill="#a39b8a" />
    <g class="branch-train">
      <path d="M0 72h258l30 13 26 19v27H0z" fill="#63625e" />
      <path d="M0 76h255l30 14 24 16v14H0z" fill="#b5b49d" />
      <path d="M0 111h308v9H0z" fill="#a26c61" />
      <path d="M15 83h32v20H15zm46 0h31v20H61zm44 0h32v20h-32zm48 0h28v20h-28zm42 0h30v20h-30zm47 0h19l31 21h-50z" fill="#75878a" />
      <path d="M19 85h24v3H19zm46 0h23v3H65zm44 0h25v3h-25zm48 0h20v3h-20zm42 0h22v3h-22z" fill="#bec2ac" />
      <path d="M27 124h25v8H27zm183 0h28v8h-28z" fill="#565952" />
      <path d="M302 106h7v4h-7z" fill="#f1cd90" />
    </g>
    <path d="M0 126h800v19H0z" fill="#aba391" />
    <path d="M0 128h800v4H0z" fill="#dfbe8f" />
    <path d="M268 132h62v4h-62zm301 0h104v4H569z" fill="#a0917f" />
    <path d="M130 27h20v20h-20z" fill="#695f56" />
    <path d="M133 30h14v14h-14z" fill="#dec39d" />
    <path d="M139 32h2v6h4v2h-6z" fill="#6d6359" />
  {:else}
    {#each [5, 133, 539, 659] as px, index}
      <g transform="translate({px} 0)">
        <path d="M0 53h120v74H0z" fill={index % 2 ? "#a98673" : "#ae8d78"} />
        <path d="M2 53h116v5H2z" fill="#c8a48c" />
        <path d="M7 65h25v17H7zm36 0h25v17H43zm36 0h28v17H79z" fill="#7a8278" />
        <path d="M8 89h101v9H8z" fill={index % 2 ? "#a3786c" : "#899280"} />
        <path d="M15 99h22v24H15zm40 0h47v24H55z" fill="#82877b" />
        <path d="M16 100h20v4H16zm39 0h46v4H55z" fill="#c3ac91" />
      </g>
    {/each}
    <path d="M277 123h211v3H277zm25 11h201v3H302z" fill="#bfa68e" />
  {/if}

  {#if weather === "market-day"}
    {@render marketStall(273, "#ba8469")}
    {@render marketStall(531, "#85917a")}
    <path d="M484 147h21l6 3-7 4h-23z" fill="#877561" />
    <path d="M486 146l5-5h11l5 5-5 4h-13z" fill="#b29170" />
  {:else if weather === "festival"}
    <path d="M193 125h92v4h-92zm121 6h71v3h-71zm147-6h79v4h-79zm87 7h74v3h-74z" fill="#d6a681" opacity=".48" />
    <path d="M184 24l27 4 55 10 62 5 69 2 69-5 69-6 57-10 24-9" fill="none" stroke="#675760" stroke-width="3" />
    {#each lanternWalk as [px, py], index}
      <g transform="translate({px} {py})">
        <g class="festival-paper" style:animation-delay={index % 2 ? "-1.1s" : undefined}>
          {@render lantern(0, 0)}
        </g>
      </g>
    {/each}
  {:else if weather === "campus"}
    <path d="M199 105v35h5v-35zm143 0v35h5v-35z" fill="#74675b" />
    <path d="M201 105l30 6 41 3 44-3 29-8" fill="none" stroke="#70695d" stroke-width="2" />
    <path class="campus-flags" d="M216 108l15 4-11 10zm23 5 17 2-10 11zm27 2h16l-8 11zm27-1 16-2-6 12zm27-3 17-5-6 12z" fill="#b07f6e" />
    <path d="M487 128h94v7h-94zm5 8h7v14h-7zm75 0h7v14h-7z" fill="#86735f" />
    <path d="M486 127h96v4h-96z" fill="#b29b75" />
    <path d="M507 127v-14l6-6h14l6 6v14z" fill="#788981" stroke="#665b50" stroke-width="2" />
    <path d="M512 118h16v6h-16z" fill="#a5a188" />
    <path d="M543 121h19v6h-19z" fill="#a77866" />
    <path d="M545 121h17v2h-17z" fill="#d8b896" />
  {/if}

  {#if renovated}
    {#if branch === "campus"}
      <g transform="translate(500 145)">
        <path d="M-13 0h100l10 6-10 4H-13l-9-4z" fill="#847566" opacity=".54" />
        <path d="M-8-32h5v34h-5zm84 0h5v34h-5z" fill="#6f685c" />
        <path d="M-17-34l11-15h82l14 15v6H-17z" fill="#61766d" />
        <path d="M-11-35l8-11h78l11 11z" fill="#9da68a" />
        <path d="M-15-34h103v4H-15z" fill="#d0b78d" />
        <path d="M2-8h65v5H2zm5 5h5v7H7zm50 0h5v7h-5z" fill="#97785f" />
        <path d="M18-9v-5h14v5zm26 0v-7h12v7z" fill="#c3ad86" />
      </g>
    {:else if branch === "garden"}
      <path d="M225 111h100v7H225zm8 7h5v13h-5zm78 0h5v13h-5z" fill="#816d5c" />
      <path d="M227 111h96v3h-96z" fill="#b49d7c" />
      {@render planter(244, 102)}
      {@render planter(273, 102)}
      {@render planter(302, 102)}
      <path d="M508 126l14-5h53l11 5-10 6h-55z" fill="#ad997b" />
      {@render planter(532, 121)}
      {@render planter(559, 121)}
    {:else if branch === "night"}
      {#each [231, 556] as post}
        <g transform="translate({post} 0)">
          <path d="M-5 148H7v7H-5zM-1 88h4v62h-4zm2-3h18v4H1z" fill="#6a5656" />
          <path d="M1 91h2v53H1zm1-5h15v2H2z" fill="#ae806a" />
          {@render lantern(17, 95)}
          <path d="M2 155h28v2H2zm9 5h16v2H11z" fill="#c89b74" opacity=".61" />
        </g>
      {/each}
    {:else if branch === "station"}
      <g transform="translate(258 141)">
        <path d="M-3 3h91v4H-3z" fill="#82796b" opacity=".5" />
        <path d="M3 2v-20h5V2zm26 0v-20h5V2zm27 0v-20h5V2zm25 0v-20h5V2z" fill="#6b7169" />
        <path d="M3-17h83v5H3zm4 9h77v3H7z" fill="#788980" />
        <path d="M8-17h72v2H8z" fill="#bec1a4" />
        <path d="M5 9h34v3H5zm43 0h33v3H48z" fill="#d3b286" />
      </g>
    {:else if branch === "loft"}
      <g transform="translate(498 148)">
        <path d="M-16 5h96l15 7-14 6H-14l-12-6z" fill="#6f625f" />
        <path d="M-14 6h94l10 5-10 4h-94l-8-4z" fill="#aa9182" />
        <path d="M-14-19h4v29h-4zm82 0h4v29h-4z" fill="#726962" />
        <path d="M-23-20l12-14h82l14 14v5H-23z" fill="#687974" />
        <path d="M-18-21l9-10h78l11 10z" fill="#a0a590" />
        <path d="M-21-19h104v3H-21z" fill="#c5ad8b" />
        <path d="M-6-2h23v5H-6zm36 0h23v5H30zM0 3h4v6H0zm38 0h4v6h-4z" fill="#936f5d" />
        <path d="M-11 9h80v3h-80zM3 4h3v8H3zm44 0h3v8h-3z" fill="#687a71" />
      </g>
    {:else if branch === "harbor"}
      <g transform="translate(505 150)">
        <path d="M-6 9h91l7 4-12 4H-9z" fill="#776b61" opacity=".48" />
        <path d="M0 0h73v7H0zm6 7h5v6H6zm55 0h5v6h-5z" fill="#665f56" />
        <path d="M0-10l8-5h62l3 6v7H0z" fill="#938171" />
        <path d="M4-9h66v3H4zm0 5h66v3H4zm0 5h64v4H4z" fill="#c1a585" />
        <path d="M77 6h9v10h-9zm-3-3h15v4H74z" fill="#8e7969" />
      </g>
    {:else}
      <g transform="translate(263 122)">
        <path d="M-11 2h105v5H-11z" fill="#7e6e60" opacity=".54" />
        <path d="M-2-43h76v47H-2z" fill="#8f7062" />
        <path d="M3-40h66V0H3z" fill="#b98b70" />
        <path d="M-7-39h82l8 7v7H-7z" fill="#697e71" />
        <path d="M-3-36h78l4 5H-3z" fill="#a6a285" />
        <path d="M9-22h48v19H9z" fill="#736e63" />
        <path d="M13-20h40v14H13z" fill="#dfb287" />
        <path d="M30-20h4v14h-4z" fill="#9e8770" />
        <path d="M6-4h53v5H6z" fill="#826b57" />
        <path d="M77-17h18l5 21H74z" fill="#656e63" />
        <path d="M80-14h12l4 15H78z" fill="#a4a284" />
        <path d="M82-10h9v2h-9zm-1 4h8v2h-8z" fill="#e3c299" />
      </g>
    {/if}
  {/if}

  {#if weather === "candlelight"}
    <path d="M0 0h800v188H0z" fill="#433645" opacity=".28" />
    {#if branch === "harbor" || branch === "loft"}
      <path d="M210 74h21v-7h35v7h22v17h-78zm330 1h12v-8h34v7h25v18h-71z" fill="#655967" />
      <path d="M220 79h9v7h-9zm16-1h10v8h-10zm20 1h9v8h-9zm294 2h10v7h-10zm18-2h10v8h-10zm19 1h12v8h-12z" fill="#d9a578" />
    {:else}
      <path d="M199 88h92v9h-92zm310 2h86v9h-86z" fill="#635260" />
      <path d="M206 91h14v4h-14zm20 0h15v4h-15zm21 0h16v4h-16zm23 0h13v4h-13zm246 2h14v4h-14zm21 0h15v4h-15zm23 0h15v4h-15zm21 0h8v4h-8z" fill="#d9a578" />
    {/if}
    <path d="M211 126h26v3h-26zm32 0h16v2h-16zm276 1h21v2h-21zm28 1h12v2h-12z" fill="#d2a27f" opacity=".42" />
    {#each [232, 281, 531, 568] as candle}
      <g transform="translate({candle} 142)">
        <path d="M-5 0h10v2H-5z" fill="#685760" />
        <path d="M-2-5h4v5h-4z" fill="#ad927c" />
        <path d="M-1-9h2v1h1v2h-4v-2h1z" fill="#eeca95" />
      </g>
    {/each}
  {:else if weather === "bottle-return"}
    <g transform="translate(286 151)">
      <path d="M-41 8h81l7 4-8 4h-81l-8-4z" fill="#74695d" opacity=".42" />
      <path d="M30-9h7v6h12v4H34l-5-5z" fill="#72655a" />
      <path d="M-40-5h74v12h-74z" fill="#775f53" />
      <path d="M-37-8h69v9h-69z" fill="#b18b6e" />
      <path d="M-33-5h61v3h-61z" fill="#d2ac84" />
      <path d="M-29 3h12v3h3v7h-3v3h-12v-3h-3V6h3zm46 0h12v3h3v7h-3v3H17v-3h-3V6h3z" fill="#636057" />
      <path d="M-26 7h7v5h-7zm46 0h7v5h-7z" fill="#a39377" />
      <path d="M-35-21h49v15h-49z" fill="#6b776a" />
      <path d="M-33-20h45v4h-45zm0 8h45v3h-45z" fill="#a2a084" />
      <path d="M-29-19v-9h4v-7h7v7h4v16h-15zm21 0v-11h4v-10h7v10h4v18H-8zm22 1v-8h3v-7h6v7h4v14H14z" fill="#66887a" stroke="#5b665a" stroke-width="2" />
      <path d="M-26-26h4v13h-4zm20-2h4v15h-4zm22 4h4v11h-4z" fill="#a1b49a" />
      <path d="M-26-36h8v3h-8zm20-5h9v3h-9zm22 7h8v3h-8z" fill="#c2ad85" />
      <path d="M-33-16h44v3h-44z" fill="#8b9480" />
    </g>
  {/if}

  {#if rain}
    <path d="M47 179h69v3H47zm180-24h94v3h-94zm284 19h84v4h-84zm141-18h57v2h-57z" fill="#b6b4aa" opacity=".73" />
    <g class="branch-rain" stroke="#d6ccd0" stroke-width="2" opacity=".48">
      {#each rainMarks as [px, py]}
        <path d="M{px} {py}l-3 13m3 16-3 13m3 16-3 13m3 16-3 13m3 16-3 13" />
      {/each}
    </g>
  {/if}
</svg>

<style>
  .branch-train { animation: branch-train 27s steps(112, end) infinite; }
  .branch-ferry { animation: branch-ferry 34s steps(125, end) infinite -12s; }
  .loft-cloud-high { animation: loft-cloud 39s steps(512, end) infinite -16s; }
  .loft-cloud-low { animation: loft-cloud 53s steps(512, end) infinite -36s; }
  .branch-rain { animation: branch-rain 700ms steps(7, end) infinite; }
  .market-valance { animation: valance 2.8s steps(2, end) infinite alternate; }
  .festival-paper { animation: festival-paper 3.7s steps(4, end) infinite alternate; transform-origin: center -7px; }
  .campus-flags { animation: valance 3.6s steps(3, end) infinite alternate; }
  .still :is(.branch-train, .branch-ferry, .branch-rain, .market-valance, .festival-paper, .campus-flags, .loft-cloud) { animation-play-state: paused; }

  @keyframes branch-train {
    0%, 12% { transform: translateX(-320px); }
    43%, 63% { transform: translateX(260px); }
    93%, 100% { transform: translateX(810px); }
  }

  @keyframes branch-ferry {
    0%, 10% { transform: translateX(-208px); }
    41%, 65% { transform: translateX(505px); }
    94%, 100% { transform: translateX(805px); }
  }

  @keyframes loft-cloud {
    from { transform: translateX(-168px); }
    to { transform: translateX(832px); }
  }

  @keyframes branch-rain {
    to { transform: translate(-3px, 29px); }
  }

  @keyframes valance {
    to { transform: translateY(-2px); }
  }

  @keyframes festival-paper {
    from { transform: rotate(-2deg); }
    to { transform: rotate(3deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .branch-train { animation: none; transform: translateX(260px); }
    .branch-ferry { animation: none; transform: translateX(505px); }
    .loft-cloud { animation: none; }
    .loft-cloud-high { transform: translateX(219px); }
    .loft-cloud-low { transform: translateX(464px); }
    .branch-rain, .market-valance, .festival-paper, .campus-flags { animation: none; }
  }
</style>
