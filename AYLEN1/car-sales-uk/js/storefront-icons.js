/**
 * Storefront SVG icon sprite — replaces Font Awesome webfont (Phase 2).
 */
(function(global) {
  'use strict';

  var SPRITE_ID = 'aylen-icon-sprite';
  var ALIASES = {
    'cart-shopping': 'shopping-cart',
    'map-marker-alt': 'location-dot',
    'external-link-alt': 'arrow-up-right-from-square',
    'mobile-screen-button': 'mobile',
    'file-arrow-down': 'download',
    'comment-dots': 'comment',
    'info-circle': 'info',
    'check-circle': 'check-circle',
    'file-lines': 'file-lines',
    'note-sticky': 'note',
    'search-plus': 'search',
    'scale-balanced': 'scale',
    'arrow-up-right-from-square': 'external',
    'hourglass-half': 'hourglass',
    'hourglass-end': 'hourglass',
    'flag-checkered': 'flag',
    'temperature-half': 'thermometer',
    'cloud-bolt': 'bolt',
    'cloud-rain': 'cloud-rain',
    'cloud-sun': 'cloud-sun',
    'truck-ramp-box': 'truck',
    'box-open': 'box-open',
    'calendar-check': 'calendar',
    'clipboard-list': 'clipboard',
    'paper-plane': 'send',
    'cart-plus': 'cart-plus',
    'file-csv': 'file-csv',
    store: 'box',
    ticket: 'bell',
    warehouse: 'box',
    mobile: 'mobile',
    flag: 'flag',
    fire: 'fire',
    map: 'location-dot',
    'map-pin': 'location-dot',
    city: 'box',
    envelope: 'send',
    calendar: 'calendar',
    circle: 'circle',
    images: 'images',
    spinner: 'spinner',
    history: 'history',
    scale: 'scale',
    external: 'external',
    truck: 'box',
    'box-open': 'box',
    clipboard: 'list',
    info: 'info',
    note: 'file-lines',
    search: 'eye',
    thermometer: 'sun',
    smog: 'cloud',
    snowflake: 'snowflake',
    'cloud-rain': 'cloud',
    'cloud-sun': 'cloud',
    hourglass: 'hourglass',
    'file-lines': 'file-lines',
    'file-csv': 'download'
  };

  var PATHS = {
    bolt: 'M349.4 442.6c-6.6 0-12.4-4.4-14-10.9L190.6 98.1l-92.5 247.6c-2.1 5.6-7.6 9.3-13.6 9.3H16c-7.7 0-13.7-7-11.6-14.5l68.6-205.1C77.5 318.4 100.2 288 128 288h64c38.4 0 73.7-21.3 91.6-55.2L349.4 88.6c1.4-2.9 4.3-4.8 7.5-4.8h48c5.1 0 9.3 4.2 9.3 9.3v349.4c0 5.1-4.2 9.3-9.3 9.3h-55.5z',
    sun: 'M361.5 1.2c5 2.1 8.4 6.8 8.4 12.3v64c0 7.4-7.2 12.8-14.5 10.5L330 76.6c-4.7-1.7-9.9 1.2-10.5 6.2s3.6 9.5 8.5 10.5l27.2 6.4c7.2 1.7 11.8 8.8 10.5 16.1l-12.8 76.8c-1.1 6.8-7.2 11.5-14 11.5H256c-8.8 0-16-7.2-16-16V16C240 7.2 247.2 0 256 0h89.5c5.5 0 10.2 3.4 12.3 8.4zM128 256a128 128 0 1 0 256 0 128 128 0 1 0-256 0z',
    cloud: 'M0 336c0 79.5 64.5 144 144 144H512c70.7 0 128-57.3 128-128 0-61.9-44-113.6-102.4-125.4C523.7 156.4 450.4 96 362 96 307.1 96 258.3 123.6 229.6 165.4 215.8 159.8 200.4 156.8 184 156.8 115.6 156.8 60 212.4 60 280.8c0 18.7 3.8 36.5 10.7 52.8C28.8 349.6 0 377.1 0 412.8 0 454.4 33.6 488 75.2 488H144V336H0z',
    box: 'M509.5 184.6L458.9 32.8C452.4 11.7 433.1 0 412.4 0H99.6C78.9 0 59.6 11.7 53.1 32.8L2.5 184.6c-6.5 21.1 5.8 43.4 26.9 49.9l256 80c5.4 1.7 11.2 1.7 16.6 0l256-80c21.1-6.5 33.4-28.8 26.9-49.9zM288 312V488c0 13.3 10.7 24 24 24s24-10.7 24-24V312l-48-15-48 15z',
    'shopping-cart': 'M0 1.5A.5.5 0 0 1 .5 1H2a.5.5 0 0 1 .485.379L2.89 3H13.5a.5.5 0 0 1 .491.592l-1.5 8A.5.5 0 0 1 12 12H4a.5.5 0 0 1-.491-.408L2.01 3.607 1.61 2H.5a.5.5 0 0 1-.5-.5zM3.102 4.5L4.313 10h7.374l1.211-5.5H3.102zM5 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
    gavel: 'M318.5 325.5l-97-97 51.5-51.5c9.4-9.4 9.4-24.6 0-33.9L267.1 71.1c-9.4-9.4-24.6-9.4-33.9 0l-51.5 51.5-97-97c-9.4-9.4-24.6-9.4-33.9 0L7.1 168.6c-9.4 9.4-9.4 24.6 0 33.9l97 97L52.6 351c-9.4 9.4-9.4 24.6 0 33.9l33.9 33.9c9.4 9.4 24.6 9.4 33.9 0l51.5-51.5 97 97c9.4 9.4 24.6 9.4 33.9 0l33.9-33.9c9.4-9.4 9.4-24.6 0-33.9z',
    crown: 'M528 448H48c-26.5 0-48 21.5-48 48v32c0 26.5 21.5 48 48 48h480c26.5 0 48-21.5 48-48v-32c0-26.5-21.5-48-48-48zM259.6 0c-11.5 0-22.1 6.2-27.8 16.2L165 160H48c-26.5 0-48 21.5-48 48v32c0 26.5 21.5 48 48 48h432c26.5 0 48-21.5 48-48V208c0-26.5-21.5-48-48-48H347L287.4 16.2C281.7 6.2 271.1 0 259.6 0z',
    'location-dot': 'M384 192c0 87.4-117 243-168.3 307.2c-12.3 15.3-35.1 15.3-47.4 0C117 435 0 279.4 0 192C0 86 86 0 192 0S384 86 384 192zM192 128a64 64 0 1 0 0-128 64 64 0 1 0 0 128z',
    check: 'M470.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-96-96c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L192 338.7 425.4 105.4c12.5-12.5 32.8-12.5 45.3 0z',
    download: 'M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32V274.7l-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7V32zM64 352c-35.3 0-64 28.7-64 64v32c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V416c0-35.3-28.7-64-64-64H64z',
    print: 'M128 0C92.7 0 64 28.7 64 64v256h16V64c0-8.8 7.2-16 16-16h320c8.8 0 16 7.2 16 16v256h16V64c0-35.3-28.7-64-64-64H128zM64 352c-35.3 0-64 28.7-64 64v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32v-96c0-35.3-28.7-64-64-64H64zM448 352c-35.3 0-64 28.7-64 64v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32v-96c0-35.3-28.7-64-64-64H448z',
    bell: 'M256 0c-17.7 0-32 14.3-32 32V51.2C119.5 61.9 64 124 64 200v16H32c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H448V200c0-76-55.5-138.1-160-148.8V32c0-17.7-14.3-32-32-32zM128 432c0 70.7 57.3 128 128 128s128-57.3 128-128H128z',
    'cart-plus': 'M0 1.5A.5.5 0 0 1 .5 1H2a.5.5 0 0 1 .485.379L2.89 3H13.5a.5.5 0 0 1 .491.592l-1.5 8A.5.5 0 0 1 12 12H4a.5.5 0 0 1-.491-.408L2.01 3.607 1.61 2H.5a.5.5 0 0 1-.5-.5zM5 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM8 1a.5.5 0 0 1 .5.5v1h1a.5.5 0 0 1 0 1h-1v1a.5.5 0 0 1-1 0v-1h-1a.5.5 0 0 1 0-1h1v-1A.5.5 0 0 1 8 1z',
    expand: 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V232h-24c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v128h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zM296 96c0-13.3 10.7-24 24-24h48c13.3 0 24 10.7 24 24v48c0 13.3-10.7 24-24 24H320c-13.3 0-24-10.7-24-24V96z',
    mobile: 'M384 0H128C92.7 0 64 28.7 64 64v384c0 35.3 28.7 64 64 64h256c35.3 0 64-28.7 64-64V64c0-35.3-28.7-64-64-64zM128 448c-17.7 0-32-14.3-32-32V96c0-17.7 14.3-32 32-32h256c17.7 0 32 14.3 32 32v320c0 17.7-14.3 32-32 32H128z',
    flag: 'M448 0H576V512H448V0zM64 64V512H0V64H64z',
    fire: 'M159.3 5.4c7.8-7.3 20.4-6.5 27 1.7l96 112c6.8 7.9 6.1 19.7-1.5 26.8L224 192l64 64 64-64-64-64c-7.6-7.1-8.3-18.9-1.5-26.8l96-112c6.5-8.2 19.1-9 27-1.7C506.6 78.8 512 95.1 512 112v288c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V112c0-16.9 5.4-33.2 15.3-46.6z',
    'file-lines': 'M224 0c-35.3 0-64 28.7-64 64V448c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V256H448c-17.7 0-32-14.3-32-32V0H224zM384 0V192H512L384 0zM160 128c0-17.7 14.3-32 32-32H384c17.7 0 32 14.3 32 32s-14.3 32-32 32H192c-17.7 0-32-14.3-32-32z',
    hourglass: 'M32 0C14.3 0 0 14.3 0 32S14.3 64 32 64H480c17.7 0 32-14.3 32-32S497.7 0 480 0H32zM0 480c0 17.7 14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H32c-17.7 0-32 14.3-32 32z',
    spinner: 'M304 48a48 48 0 1 0-96 0 48 48 0 1 0 96 0zm0 416a48 48 0 1 0-96 0 48 48 0 1 0 96 0zM48 304a48 48 0 1 0 0-96 48 48 0 1 0 0 96zm464-48a48 48 0 1 0-96 0 48 48 0 1 0 96 0z',
    history: 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24V264l83.6 83.6c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0L233.4 284.7c-4.5-4.5-7-10.6-7-17V152c0-13.3 10.7-24 24-24z',
    external: 'M320 0c-17.7 0-32 14.3-32 32s14.3 32 32 32h82.7L201.4 265.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L448 109.3V192c0 17.7 14.3 32 32 32s32-14.3 32-32V32c0-17.7-14.3-32-32-32H320zM192 128c-17.7 0-32 14.3-32 32V448c0 17.7 14.3 32 32 32H448c17.7 0 32-14.3 32-32V352c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H224V192h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H192z',
    info: 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V200h-24c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v136h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zM256 96a32 32 0 1 1 0 64 32 32 0 1 1 0-64z',
    'check-circle': 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z',
    circle: 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512z',
    images: 'M0 96C0 60.7 28.7 32 64 32H448c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zM128 416a32 32 0 1 0 0-64 32 32 0 1 0 0 64zM448 128H64V384l128-128 64 64 128-128 64 64V128z',
    calendar: 'M128 0c17.7 0 32 14.3 32 32V64H352V32c0-17.7 14.3-32 32-32s32 14.3 32 32V64h48c26.5 0 48 21.5 48 48v48H0V112C0 85.5 21.5 64 48 64H96V32c0-17.7 14.3-32 32-32zM0 192H512V464c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V192z',
    scale: 'M640 0c0 53-43 96-96 96s-96-43-96-96h128zM576 128c-35.3 0-64-28.7-64-64s28.7-64 64-64 64 28.7 64 64-28.7 64-64 64zM0 96C0 43 43 0 96 0s96 43 96 96H64zM128 128c35.3 0 64-28.7 64-64S163.3 0 128 0 64 28.7 64 64s28.7 64 64 64z',
    snowflake: 'M256 0c17.7 0 32 14.3 32 32V64h64V32c0-17.7 14.3-32 32-32s32 14.3 32 32V64h32c17.7 0 32 14.3 32 32s-14.3 32-32 32H416V192h32c17.7 0 32 14.3 32 32s-14.3 32-32 32H416v64h32c17.7 0 32 14.3 32 32s-14.3 32-32 32H416v32c0 17.7-14.3 32-32 32s-32-14.3-32-32V320H256v64c0 17.7-14.3 32-32 32s-32-14.3-32-32V320H96c-17.7 0-32-14.3-32-32s14.3-32 32-32h32V192H96c-17.7 0-32-14.3-32-32s14.3-32 32-32h32V64H96C78.3 64 64 49.7 64 32S78.3 0 96 0h32V32c0 17.7 14.3 32 32 32s32-14.3 32-32V0h32z',
    'chevron-left': 'M224 480L64 320l160-160 32 32-96 96 96 96-32 32z',
    'chevron-right': 'M288 320l96-96-96-96-32 32 64 64-64 64 32 32z',
    signal: 'M576 320c0 35.3-28.7 64-64 64H448v-64h64c17.7 0 32-14.3 32-32V64c0-17.7-14.3-32-32-32H64C46.3 32 32 46.3 32 64v224c0 17.7 14.3 32 32 32h64v64H64c-35.3 0-64-28.7-64-64V64C0 28.7 28.7 0 64 0H512c35.3 0 64 28.7 64 64v256z',
    comment: 'M256 32C114.6 32 0 125.1 0 240c0 49.6 21.4 95 57 130.7C44.5 421.1 2.7 466 2.2 466.5c-2.2 2.3-2.8 5.7-1.5 8.7S4.8 480 8 480c66.3 0 116-31.8 140.6-51.4 32.7 12.3 69 19.4 107.4 19.4 141.4 0 256-93.1 256-208S397.4 32 256 32z',
    send: 'M498.1 5.6c10.1 7 15.4 19.1 13.5 31.2l-64 416c-1.5 9.7-7.4 18.2-16 23s-18.9 5.4-28 1.6L284 427.7l-68.5 74.1c-8.9 9.7-22.9 12.9-35.2 8.1S160 493.2 160 480V396.4c0-4 1.5-7.8 4.2-10.7L331.8 202.8c5.8-6.3 5.6-16-.4-22s-15.7-6.4-22-.7L106 329.1 24.6 285.5c-9.1-5.1-13.8-15.6-11.9-25.9s11.2-18.5 21.6-19.3l448-32z',
    eye: 'M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1-288 0z',
    trophy: 'M400 0H176c-26.5 0-48 21.5-48 48v48H48C21.5 96 0 117.5 0 144v16c0 53 43 96 96 96h16.5c24.5 56.3 76 98.7 140.3 113.7V464H128c-17.7 0-32 14.3-32 32s14.3 32 32 32H384c17.7 0 32-14.3 32-32s-14.3-32-32-32H275.7V369.7C340 354.7 391.5 312.3 416 256H432c53 0 96-43 96-96V144c0-26.5-21.5-48-48-48H448V48c0-26.5-21.5-48-48-48z',
    list: 'M64 144a48 48 0 1 0 0-96 48 48 0 1 0 0 96zM0 240a48 48 0 1 0 96 0 48 48 0 1 0-96 0zM64 464a48 48 0 1 0 0-96 48 48 0 1 0 0 96zM448 64H192c-8.8 0-16 7.2-16 16s7.2 16 16 16H448c8.8 0 16-7.2 16-16s-7.2-16-16-16zm0 160H192c-8.8 0-16 7.2-16 16s7.2 16 16 16H448c8.8 0 16-7.2 16-16s-7.2-16-16-16zM192 384H448c8.8 0 16-7.2 16-16s-7.2-16-16-16H192c-8.8 0-16 7.2-16 16s7.2 16 16 16z',
    telegram: 'M524.5 69.8a8 8 0 0 0-8.3-1.3L24.5 214.4a8 8 0 0 0 3.2 15.2l110.5 18.6 45.8 137.4a8 8 0 0 0 13.1 3.2L332 272.8l115.5 86.3a8 8 0 0 0 12.6-4.7l67.4-279.6a8 8 0 0 0-3.2-9.2z',
    whatsapp: 'M380.9 97.1C339 55.2 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zM223.9 413.8c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3 18.6-68.1-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6z'
  };

  function resolveName(raw) {
    var name = ALIASES[raw] || raw;
    if (PATHS[name]) return name;
    if (ALIASES[name] && PATHS[ALIASES[name]]) return ALIASES[name];
    return name;
  }

  function ensureSprite() {
    if (document.getElementById(SPRITE_ID)) return;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = SPRITE_ID;
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    Object.keys(PATHS).forEach(function(name) {
      var sym = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
      sym.id = 'icon-' + name;
      sym.setAttribute('viewBox', '0 0 512 512');
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('fill', 'currentColor');
      path.setAttribute('d', PATHS[name]);
      sym.appendChild(path);
      defs.appendChild(sym);
    });
    svg.appendChild(defs);
    (document.body || document.documentElement).appendChild(svg);
  }

  function iconClassToName(el) {
    var list = (el.getAttribute('class') || '').split(/\s+/);
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.indexOf('fa-') === 0 && c !== 'fa-spin' && c !== 'fa-fw') {
        return c.slice(3);
      }
    }
    return '';
  }

  function upgradeIcon(el) {
    if (!el || el.getAttribute('data-aylen-icon') === '1') return;
    var raw = iconClassToName(el);
    if (!raw) return;
    var name = resolveName(raw);
    if (!PATHS[name]) return;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    var cls = (el.getAttribute('class') || '')
      .replace(/\bfa[^\s]*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    svg.setAttribute('class', (cls ? cls + ' ' : '') + 'aylen-icon');
    if (el.getAttribute('aria-hidden')) svg.setAttribute('aria-hidden', el.getAttribute('aria-hidden'));
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#icon-' + name);
    svg.appendChild(use);
    svg.setAttribute('data-aylen-icon', '1');
    el.parentNode.replaceChild(svg, el);
  }

  function upgradeFaIcons(root) {
    ensureSprite();
    var scope = root || document;
    scope.querySelectorAll('i.fa, i.fas, i.fab, i.fa-solid, i.fa-brands').forEach(upgradeIcon);
  }

  function html(name, className) {
    var resolved = resolveName(name);
    if (!PATHS[resolved]) return '';
    return '<svg class="aylen-icon' + (className ? ' ' + className : '') + '" aria-hidden="true">' +
      '<use href="#icon-' + resolved + '"></use></svg>';
  }

  var observerTimer = null;
  function watchDom() {
    if (!('MutationObserver' in global)) return;
    var obs = new MutationObserver(function() {
      if (observerTimer) clearTimeout(observerTimer);
      observerTimer = setTimeout(function() {
        upgradeFaIcons(document.body);
      }, 120);
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  function init() {
    ensureSprite();
    upgradeFaIcons(document.body);
    watchDom();
  }

  global.AYLEN_ICONS = {
    upgrade: upgradeFaIcons,
    html: html,
    init: init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
