import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export function EntryIllustration({ splash, dark }: { splash?: boolean; dark: boolean }) {
  const paper = dark ? '#182922' : splash ? '#FFFFFF' : '#F2EDDF';
  const hill = dark ? '#223A30' : '#DCE5D9';
  const land = dark ? '#355247' : '#A7BDAA';
  const water = dark ? '#293F3D' : '#BDD5D0';
  const pine = dark ? '#94B8A2' : '#315D4C';
  const figure = dark ? '#D1DFD2' : '#244739';
  return <Svg width="100%" height="100%" viewBox="0 0 400 268" preserveAspectRatio={splash ? 'xMidYMid meet' : 'xMidYMid slice'}>
    <Defs>
      <LinearGradient id="wash" x1="0" x2="0" y1="0" y2="1">
        <Stop offset="0" stopColor={dark ? '#263B30' : '#F3EADB'} />
        <Stop offset="1" stopColor={paper} />
      </LinearGradient>
      <LinearGradient id="water" x1="0" x2="0" y1="0" y2="1">
        <Stop offset="0" stopColor={water} />
        <Stop offset="1" stopColor={paper} />
      </LinearGradient>
    </Defs>
    {!splash && <Rect width="400" height="268" fill="url(#wash)" />}
    <Circle cx="247" cy="81" r="40" fill={dark ? '#5D6550' : '#E7C997'} opacity={splash ? 0.65 : 0.8} />
    <Path d="M0 150 72 112 130 137 192 81 252 130 304 102 400 150Z" fill={hill} />
    <Path d="M0 164 79 141 141 155 208 121 278 152 340 129 400 154V181H0Z" fill={land} />
    <Path d="M0 172C105 164 274 168 400 171V257H0Z" fill="url(#water)" />
    <G stroke={paper} strokeWidth="2" strokeLinecap="round">
      <Path d="M218 183H317m-50 13h73m-127 15h34m-96 16h141m-222-14h49" />
    </G>
    <Path d="M0 194c38-18 98-15 127-4 29 11 52 14 76 12-21 17-80 31-128 28H0Z" fill={pine} />
    <Path d="M34 192v-63m0 0-18 32h10l-14 21h44l-14-21h10Zm43 4v-49m0 0-14 24h8l-11 17h34l-11-17h8Z"
      fill={pine} stroke={pine} strokeWidth="2" strokeLinejoin="round" />
    <Ellipse cx="126" cy="204" rx="32" ry="5" fill="#132C24" opacity=".16" />
    <Circle cx="122" cy="139" r="8" fill={figure} />
    <Path d="M111 138h22m-12 11-7 24 2 23m4-24 11 24m-11-43 13 7 16-9"
      stroke={figure} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Path d="m146 153 37-34q17-15 38-4" stroke={figure} strokeWidth="2.8" strokeLinecap="round" fill="none" />
    <Path d="M221 115v68" stroke={figure} strokeWidth="1" fill="none" opacity=".65" />
    <Circle cx="221" cy="183" r="2.5" fill={dark ? '#DCAE78' : '#B5793E'} />
  </Svg>;
}
