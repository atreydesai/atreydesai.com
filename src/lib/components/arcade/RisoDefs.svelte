<!-- Roughening filters for the arcade's riso sheets, pen loops, and small
     drawn marks. Same technique as the homepage banner: every layer of one
     sheet shares a filter, so the paper and its misregistered slab wobble
     together. -->
<svg class="boba-defs" width="0" height="0" aria-hidden="true" focusable="false">
  <filter id="boba-rough" x="-10%" y="-25%" width="120%" height="150%">
    <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="5" />
    <feDisplacementMap in="SourceGraphic" scale="5" />
  </filter>
  <filter id="boba-rough-fine" x="-30%" y="-30%" width="160%" height="160%">
    <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="9" />
    <feDisplacementMap in="SourceGraphic" scale="1.8" />
  </filter>
  <filter id="boba-rough-loop" x="-20%" y="-30%" width="140%" height="160%">
    <feTurbulence type="fractalNoise" baseFrequency="0.2" numOctaves="2" seed="4" />
    <feDisplacementMap in="SourceGraphic" scale="1.1" />
  </filter>
</svg>

<style>
  .boba-defs {
    position: absolute;
    width: 0;
    height: 0;
  }
</style>
