import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal, StatusBar,
  Platform, Alert, useColorScheme, useWindowDimensions, KeyboardAvoidingView,
  ActivityIndicator, Pressable, StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Line, Rect, Circle, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => { });

/* ---------- Constantes ---------- */
const ORANGE = '#FF7900', BAD = '#CD3C14', OK = '#2E9E2E';
const FR = 'Inter_400Regular', FS = 'Inter_600SemiBold', FB = 'Inter_700Bold';
const KEY = 'gestion-depenses-v1';

const LIGHT = { bg: '#F2F2F2', card: '#FFFFFF', ink: '#000000', mut: '#6B6B6B', line: '#E4E4E4', chip: '#FFF0E0', btnBg: '#000000', btnFg: '#FFFFFF' };
const DARK = { bg: '#000000', card: '#1B1B1B', ink: '#FFFFFF', mut: '#A0A0A0', line: '#333333', chip: '#3A2410', btnBg: '#FFFFFF', btnFg: '#000000' };

const CATS = [
  { id: 'logement', n: 'Logement', icon: 'home-outline', c: '#FF7900' },
  { id: 'alim', n: 'Alimentation', icon: 'restaurant-outline', c: '#4BB543' },
  { id: 'transport', n: 'Transport', icon: 'bus-outline', c: '#2F80ED' },
  { id: 'comm', n: 'Crédit & internet', icon: 'phone-portrait-outline', c: '#9B51E0' },
  { id: 'etudes', n: 'Études', icon: 'book-outline', c: '#F2C94C' },
  { id: 'sante', n: 'Santé', icon: 'medkit-outline', c: '#EB5757' },
  { id: 'loisirs', n: 'Loisirs', icon: 'game-controller-outline', c: '#00A3A3' },
  { id: 'business', n: 'Business', icon: 'bag-handle-outline', c: '#8D6E63' },
  { id: 'autres', n: 'Autres', icon: 'receipt-outline', c: '#8A8A8A' },
];
const catOf = (id) => CATS.find((c) => c.id === id) || CATS[CATS.length - 1];

const TABS = [
  ['home', 'home', 'Accueil'],
  ['list', 'receipt', 'Dépenses'],
  ['bilan', 'stats-chart', 'Bilan'],
  ['vault', 'lock-closed', 'Coffre'],
  ['advice', 'bulb', 'Conseils'],
];

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_S = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/* ---------- Fonctions utilitaires ---------- */
const pad = (n) => String(n).padStart(2, '0');
const ymOf = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1);
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const shiftMonth = (m, k) => { const [y, mo] = m.split('-').map(Number); return ymOf(new Date(y, mo - 1 + k, 1)); };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const monthName = (m, short) => { const [y, mo] = m.split('-').map(Number); return short ? MONTHS_S[mo - 1] : MONTHS[mo - 1] + ' ' + y; };
const daysIn = (m) => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 0).getDate(); };
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0') + '\u00A0FCFA';
const dateShort = (s) => { const [, m, d] = s.split('-').map(Number); return d + ' ' + MONTHS_S[m - 1]; };
const dateLong = (s) => { const [y, m, d] = s.split('-').map(Number); return d + ' ' + MONTHS[m - 1] + ' ' + y; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const isCurrent = (m) => m === ymOf(new Date());
const daysElapsed = (m) => (isCurrent(m) ? new Date().getDate() : m < ymOf(new Date()) ? daysIn(m) : 0);
const validDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T12:00:00');
  return !isNaN(d.getTime()) && d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) === s;
};

const inMonth = (S, m) => S.expenses.filter((e) => e.date.slice(0, 7) === m);
const sum = (a) => a.reduce((t, e) => t + e.amount, 0);
const byCat = (S, m) => {
  const o = {};
  inMonth(S, m).forEach((e) => { o[e.cat] = (o[e.cat] || 0) + e.amount; });
  return Object.entries(o).sort((a, b) => b[1] - a[1]);
};
const sortedExp = (arr) => [...arr].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

/* ---------- Conseils (calculés sur le téléphone) ---------- */
function localAdvice(S, m, kind) {
  const spent = sum(inMonth(S, m)), cats = byCat(S, m), b = S.budget, L = [];
  if (kind === 'conseil') {
    if (!spent) return ['Ajoutez quelques dépenses du mois pour recevoir des conseils personnalisés.'];
    const top = cats[0], share = top[1] / spent;
    L.push(`Votre plus grosse dépense est « ${catOf(top[0]).n} » : ${Math.round(share * 100)} % du total. Fixez-lui un plafond mensuel.`);
    const al = cats.find((c) => c[0] === 'alim');
    if (al && al[1] / spent > 0.4) L.push("L'alimentation dépasse 40 % de vos dépenses : planifiez vos repas de la semaine et achetez en gros les produits de base.");
    const lo = cats.find((c) => c[0] === 'loisirs');
    if (lo && lo[1] / spent > 0.2) L.push('Les loisirs pèsent plus de 20 %. Gardez une enveloppe fixe et arrêtez-vous quand elle est vide.');
    const de = Math.max(daysElapsed(m), 1);
    if (b > 0) {
      const proj = (spent / de) * daysIn(m);
      L.push(proj > b
        ? `À ce rythme, vous dépasserez votre budget de ${fmt(proj - b)}. Réduisez à ${fmt(Math.max(0, (b - spent) / Math.max(daysIn(m) - de, 1)))} par jour pour finir dans le budget.`
        : "Votre rythme actuel respecte le budget. Placez l'écart dans le coffre-fort.");
    } else L.push("Fixez un budget mensuel : c'est lui qui rend tous les autres conseils précis.");
    L.push("Dès qu'une entrée d'argent arrive, versez d'abord votre épargne dans le coffre-fort, puis dépensez le reste.");
  } else if (kind === 'business') {
    L.push('Vendre en ligne : revendre des chaussures et accessoires avec un catalogue WhatsApp Business, sans stock lourd au départ.');
    L.push("Services liés à l'eau : diagnostic de petites fuites, installation de réservoirs ou de pompes pour particuliers, grâce à votre formation en hydraulique.");
    L.push('Vente de documents PDF : fiches de cours et guides pratiques, paiement par Orange Money ou MTN MoMo.');
    L.push('Petite restauration ou jus locaux sur un campus : faible capital, rotation rapide.');
    L.push('Soutien scolaire en mathématiques et physique : aucun capital, seulement du temps.');
    L.push('Commencez par une seule idée, avec un capital que vous pouvez perdre sans risque, puis réinvestissez les premiers gains.');
  } else {
    L.push('Présentez vos modèles en photos nettes avec le prix visible, dans un catalogue WhatsApp Business et en statut chaque jour.');
    L.push('Publiez de courtes vidéos TikTok : fabrication, essayage, avant/après. Une vidéo par jour pendant 30 jours.');
    L.push('Offrez une réduction de parrainage : le client qui amène un ami gagne un rabais sur sa prochaine paire.');
    L.push("Lancez des promotions limitées dans le temps (48 h) pour créer l'urgence, surtout avant les fêtes et la rentrée.");
    L.push("Collectez les avis et photos de vos clients satisfaits et republiez-les : la preuve sociale vend mieux qu'une annonce.");
    L.push("Proposez la livraison locale et le paiement mobile pour supprimer les freins à l'achat.");
  }
  return L;
}

/* ---------- Petits composants ---------- */
function Bar({ pct, color, track, h = 10 }) {
  return (
    <View style={{ height: h, borderRadius: 6, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', backgroundColor: color, borderRadius: 6 }} />
    </View>
  );
}

function Btn({ C, label, onPress, kind = 'dark', small, style }) {
  const bg = kind === 'or' ? ORANGE : kind === 'ghost' ? 'transparent' : C.btnBg;
  const fg = kind === 'or' ? '#000' : kind === 'ghost' ? C.ink : C.btnFg;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        { backgroundColor: bg, borderRadius: 999, paddingVertical: small ? 9 : 13, paddingHorizontal: small ? 16 : 20, alignItems: 'center', justifyContent: 'center' },
        kind === 'ghost' && { borderWidth: 2, borderColor: C.ink },
        style,
      ]}
    >
      <Text style={{ fontFamily: FB, fontSize: small ? 14 : 15, color: fg }}>{label}</Text>
    </TouchableOpacity>
  );
}

function IconDot({ icon, color, bg, size = 40 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.5} color={color} />
    </View>
  );
}

function ExpenseRow({ e, C, st, onDelete, first }) {
  const c = catOf(e.cat);
  return (
    <View style={[st.row, first && { borderTopWidth: 0 }]}>
      <IconDot icon={c.icon} color={c.c} bg={C.chip} />
      <View style={{ flex: 1, minWidth: 0, marginHorizontal: 12 }}>
        <Text numberOfLines={1} style={{ fontFamily: FB, fontSize: 15, color: C.ink }}>{e.note || c.n}</Text>
        <Text style={{ fontFamily: FR, fontSize: 13, color: C.mut }}>{c.n} · {dateShort(e.date)}</Text>
      </View>
      <Text style={{ fontFamily: FB, fontSize: 14, color: C.ink }}>{fmt(e.amount)}</Text>
      {onDelete ? (
        <TouchableOpacity onPress={onDelete} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginLeft: 4 }} accessibilityLabel="Supprimer">
          <Ionicons name="close" size={20} color={C.mut} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/* ---------- Graphiques ---------- */
function LineChart({ S, m, C, w }) {
  const n = daysIn(m), upto = daysElapsed(m);
  const daily = Array(n + 1).fill(0);
  inMonth(S, m).forEach((e) => { daily[+e.date.slice(8, 10)] += e.amount; });
  const cum = []; let t = 0;
  for (let d = 1; d <= upto; d++) { t += daily[d]; cum.push(t); }
  const total = t, b = S.budget, ymax = Math.max(b, total, 1) * 1.12;
  const W = 320, H = 170, L = 8, R = 8, T = 10, B = 22, iw = W - L - R, ih = H - T - B;
  const x = (d) => L + ((d - 1) / (n - 1)) * iw;
  const y = (v) => T + ih - (v / ymax) * ih;
  let path = '';
  cum.forEach((v, i) => { path += (i ? 'L' : 'M') + x(i + 1).toFixed(1) + ' ' + y(v).toFixed(1); });
  const area = cum.length ? path + `L${x(cum.length).toFixed(1)} ${y(0)}L${x(1)} ${y(0)}Z` : '';
  return (
    <View>
      <Svg width={w} height={(w * H) / W} viewBox={`0 0 ${W} ${H}`}>
        <Line x1={L} y1={y(0)} x2={W - R} y2={y(0)} stroke={C.line} strokeWidth={1} />
        {b > 0 && <Line x1={L} y1={y(b)} x2={W - R} y2={y(b)} stroke={BAD} strokeDasharray="4 3" strokeWidth={1.5} />}
        {b > 0 && <Line x1={x(1)} y1={y(0)} x2={x(n)} y2={y(b)} stroke={C.mut} strokeDasharray="1 4" strokeWidth={1.5} strokeLinecap="round" />}
        {area ? <Path d={area} fill={ORANGE} fillOpacity={0.18} /> : null}
        {area ? <Path d={path} fill="none" stroke={ORANGE} strokeWidth={2.5} strokeLinejoin="round" /> : null}
        {cum.length ? <Circle cx={x(cum.length)} cy={y(total)} r={4} fill={ORANGE} /> : null}
        {[1, Math.ceil(n / 2), n].map((d) => (
          <SvgText key={d} x={x(d)} y={H - 6} fill={C.mut} fontSize={10} fontFamily={FR} textAnchor={d === 1 ? 'start' : d === n ? 'end' : 'middle'}>{String(d)}</SvgText>
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
        <Legend color={ORANGE} label="Dépenses cumulées" C={C} />
        {b > 0 && <Legend color={BAD} label="Budget" C={C} />}
        {b > 0 && <Legend color={C.mut} label="Rythme idéal" C={C} />}
      </View>
    </View>
  );
}
function Legend({ color, label, C }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14, marginBottom: 4 }}>
      <View style={{ width: 14, height: 3, backgroundColor: color, marginRight: 5 }} />
      <Text style={{ fontFamily: FR, fontSize: 12, color: C.mut }}>{label}</Text>
    </View>
  );
}

function MonthsChart({ S, m, C, w }) {
  const ms = [];
  for (let i = 5; i >= 0; i--) ms.push(shiftMonth(m, -i));
  const vals = ms.map((k) => sum(inMonth(S, k))), mx = Math.max(...vals, S.budget, 1);
  const W = 320, H = 150, B = 20, T = 16, bw = 34, gap = (W - bw * 6) / 7;
  return (
    <Svg width={w} height={(w * H) / W} viewBox={`0 0 ${W} ${H}`}>
      {vals.map((v, i) => {
        const h = (v / mx) * (H - B - T), x = gap + i * (bw + gap), cur = ms[i] === m;
        return (
          <React.Fragment key={ms[i]}>
            <Rect x={x} y={H - B - h} width={bw} height={Math.max(h, 1)} rx={5} fill={cur ? ORANGE : C.line} />
            {v > 0 && <SvgText x={x + bw / 2} y={H - B - h - 4} fill={C.mut} fontSize={10} fontFamily={FR} textAnchor="middle">{v >= 1000 ? Math.round(v / 1000) + 'k' : String(v)}</SvgText>}
            <SvgText x={x + bw / 2} y={H - 5} fill={C.mut} fontSize={10} fontFamily={FR} textAnchor="middle">{monthName(ms[i], true)}</SvgText>
          </React.Fragment>
        );
      })}
      {S.budget > 0 && <Line x1={0} y1={H - B - (S.budget / mx) * (H - B - T)} x2={W} y2={H - B - (S.budget / mx) * (H - B - T)} stroke={BAD} strokeDasharray="4 3" strokeWidth={1.5} />}
    </Svg>
  );
}

function CatChart({ S, m, C }) {
  const cats = byCat(S, m), tot = sum(inMonth(S, m));
  if (!tot) return null;
  let a = -Math.PI / 2;
  const arcs = cats.map(([id, v]) => {
    const f = v / tot, a2 = a + f * 2 * Math.PI;
    const p = (ang) => [60 + 44 * Math.cos(ang), 60 + 44 * Math.sin(ang)];
    const [x1, y1] = p(a), [x2, y2] = p(a2);
    const el = f >= 0.999
      ? <Circle key={id} cx={60} cy={60} r={44} fill="none" stroke={catOf(id).c} strokeWidth={22} />
      : <Path key={id} d={`M${x1} ${y1}A44 44 0 ${f > 0.5 ? 1 : 0} 1 ${x2} ${y2}`} fill="none" stroke={catOf(id).c} strokeWidth={22} />;
    a = a2;
    return el;
  });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
      <Svg width={150} height={150} viewBox="0 0 120 120">{arcs}</Svg>
      <View style={{ flex: 1, minWidth: 140, marginLeft: 14 }}>
        {cats.slice(0, 5).map(([id, v]) => (
          <View key={id} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: catOf(id).c, marginRight: 6 }} />
            <Text style={{ fontFamily: FR, fontSize: 13, color: C.ink }}>{catOf(id).n} </Text>
            <Text style={{ fontFamily: FB, fontSize: 13, color: C.ink }}>{Math.round((v / tot) * 100)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ---------- Fenêtres (bottom sheets) ---------- */
function SheetFrame({ C, st, title, onClose, children }) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={st.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={{ fontFamily: FB, fontSize: 20, color: C.ink, marginBottom: 14 }}>{title}</Text>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
function Field({ C, st, label, ...props }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontFamily: FB, fontSize: 13, color: C.ink, marginBottom: 5 }}>{label}</Text>
      <TextInput placeholderTextColor={C.mut} style={st.input} {...props} />
    </View>
  );
}
function ErrText({ t }) {
  return t ? <Text style={{ fontFamily: FR, color: BAD, fontSize: 13, marginBottom: 10 }}>{t}</Text> : null;
}
function SheetButtons({ C, label, onSave, onClose }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
      <Btn C={C} kind="or" label={label} onPress={onSave} style={{ flex: 1, marginRight: 8 }} />
      <Btn C={C} kind="ghost" small label="Annuler" onPress={onClose} />
    </View>
  );
}

function AddSheet({ C, st, month, defaultCat, onSave, onClose }) {
  const t = todayStr();
  const [amt, setAmt] = useState('');
  const [cat, setCat] = useState(defaultCat);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(t.slice(0, 7) === month ? t : month + '-01');
  const [err, setErr] = useState('');
  const go = () => {
    const n = Math.round(Number(amt));
    if (!(n > 0)) return setErr('Entrez un montant supérieur à 0.');
    if (!validDate(date)) return setErr('Date invalide. Format : AAAA-MM-JJ (ex. 2026-10-26).');
    onSave({ id: uid(), amount: n, cat, note: note.trim(), date });
  };
  return (
    <SheetFrame C={C} st={st} title="Nouvelle dépense" onClose={onClose}>
      <Field C={C} st={st} label="Montant (FCFA)" value={amt} onChangeText={setAmt} keyboardType="numeric" placeholder="2500" autoFocus />
      <Text style={{ fontFamily: FB, fontSize: 13, color: C.ink, marginBottom: 5 }}>Catégorie</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
        {CATS.map((c) => {
          const on = c.id === cat;
          return (
            <TouchableOpacity key={c.id} onPress={() => setCat(c.id)} style={[st.chip, on && { backgroundColor: ORANGE, borderColor: ORANGE }]}>
              <Ionicons name={c.icon} size={16} color={on ? '#000' : C.ink} style={{ marginRight: 6 }} />
              <Text style={{ fontFamily: on ? FB : FR, fontSize: 14, color: on ? '#000' : C.ink }}>{c.n}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Field C={C} st={st} label="Note (facultatif)" value={note} onChangeText={setNote} maxLength={60} placeholder="Ex. : marché, taxi, forfait…" />
      <Field C={C} st={st} label="Date (AAAA-MM-JJ)" value={date} onChangeText={setDate} placeholder="2026-10-26" keyboardType="numbers-and-punctuation" maxLength={10} />
      <ErrText t={err} />
      <SheetButtons C={C} label="Enregistrer la dépense" onSave={go} onClose={onClose} />
    </SheetFrame>
  );
}

function BudgetSheet({ C, st, current, onSave, onClose }) {
  const [v, setV] = useState(current ? String(current) : '');
  const [err, setErr] = useState('');
  const go = () => {
    const n = Math.round(Number(v));
    if (!(n >= 0)) return setErr('Entrez un montant valide.');
    onSave(n);
  };
  return (
    <SheetFrame C={C} st={st} title="Budget mensuel" onClose={onClose}>
      <Field C={C} st={st} label="Combien voulez-vous dépenser au maximum par mois ?" value={v} onChangeText={setV} keyboardType="numeric" placeholder="150000" autoFocus />
      <ErrText t={err} />
      <SheetButtons C={C} label="Enregistrer le budget" onSave={go} onClose={onClose} />
    </SheetFrame>
  );
}

function GoalSheet({ C, st, onSave, onClose }) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [dl, setDl] = useState('');
  const [err, setErr] = useState('');
  const go = () => {
    const t = Math.round(Number(target));
    if (!name.trim()) return setErr('Donnez un nom à votre objectif.');
    if (!(t > 0)) return setErr('Entrez le montant à atteindre.');
    if (dl && !validDate(dl)) return setErr('Date invalide. Format : AAAA-MM-JJ, ou laissez vide.');
    onSave({ id: uid(), name: name.trim(), target: t, saved: 0, deadline: dl });
  };
  return (
    <SheetFrame C={C} st={st} title="Nouvel objectif d'épargne" onClose={onClose}>
      <Field C={C} st={st} label="Nom de l'objectif" value={name} onChangeText={setName} maxLength={40} placeholder="Ordinateur portable" autoFocus />
      <Field C={C} st={st} label="Montant à atteindre (FCFA)" value={target} onChangeText={setTarget} keyboardType="numeric" placeholder="300000" />
      <Field C={C} st={st} label="Date limite (facultatif, AAAA-MM-JJ)" value={dl} onChangeText={setDl} placeholder="2027-03-31" keyboardType="numbers-and-punctuation" maxLength={10} />
      <ErrText t={err} />
      <SheetButtons C={C} label="Créer l'objectif" onSave={go} onClose={onClose} />
    </SheetFrame>
  );
}

function MoveSheet({ C, st, goal, sign, onSave, onClose }) {
  const [v, setV] = useState('');
  const [err, setErr] = useState('');
  const go = () => {
    const n = Math.round(Number(v));
    if (!(n > 0)) return setErr('Entrez un montant supérieur à 0.');
    if (sign < 0 && n > goal.saved) return setErr('Vous ne pouvez pas retirer plus que ' + fmt(goal.saved) + '.');
    onSave(sign * n);
  };
  return (
    <SheetFrame C={C} st={st} title={`${sign > 0 ? 'Verser dans' : 'Retirer de'} « ${goal.name} »`} onClose={onClose}>
      <Field C={C} st={st} label="Montant (FCFA)" value={v} onChangeText={setV} keyboardType="numeric" placeholder="10000" autoFocus />
      <ErrText t={err} />
      <SheetButtons C={C} label={sign > 0 ? 'Verser' : 'Retirer'} onSave={go} onClose={onClose} />
    </SheetFrame>
  );
}

/* ---------- Application ---------- */
export default function App() {
  const scheme = useColorScheme();
  const C = scheme === 'dark' ? DARK : LIGHT;
  const st = useMemo(() => makeStyles(C), [scheme]);
  const { width } = useWindowDimensions();
  const cw = Math.min(width, 520) - 64;

  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold });
  const [S, setS] = useState({ budget: 0, expenses: [], goals: [] });
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('home');
  const [month, setMonth] = useState(ymOf(new Date()));
  const [catSel, setCatSel] = useState('alim');
  const [sheet, setSheet] = useState(null);
  const [out, setOut] = useState({ title: '', items: null, loading: false });

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => { if (v) setS((s) => ({ ...s, ...JSON.parse(v) })); })
      .catch(() => { })
      .finally(() => setLoaded(true));
  }, []);
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(KEY, JSON.stringify(S)).catch(() => { });
  }, [S, loaded]);
  useEffect(() => {
    if (fontsLoaded && loaded) SplashScreen.hideAsync().catch(() => { });
  }, [fontsLoaded, loaded]);

  if (!fontsLoaded || !loaded) return null;

  const closeSheet = () => setSheet(null);
  const addExpense = (e) => { setS((s) => ({ ...s, expenses: [...s.expenses, e] })); setCatSel(e.cat); setMonth(e.date.slice(0, 7)); closeSheet(); };
  const delExpense = (id) => setS((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id) }));
  const saveBudget = (n) => { setS((s) => ({ ...s, budget: n })); closeSheet(); };
  const addGoal = (g) => { setS((s) => ({ ...s, goals: [...s.goals, g] })); closeSheet(); };
  const moveGoal = (id, delta) => { setS((s) => ({ ...s, goals: s.goals.map((g) => (g.id === id ? { ...g, saved: g.saved + delta } : g)) })); closeSheet(); };
  const delGoal = (id) => {
    Alert.alert('Supprimer', 'Supprimer cet objectif et son épargne enregistrée ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => setS((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) })) },
    ]);
  };
  const runAdvice = (kind) => {
    const titles = { conseil: 'Mes conseils', business: 'Business à réaliser', marketing: 'Stratégies marketing chaussures' };
    setOut({ title: titles[kind], items: null, loading: true });
    setTimeout(() => setOut({ title: titles[kind], items: localAdvice(S, month, kind), loading: false }), 350);
  };

  /* ----- Écrans ----- */
  const renderHome = () => {
    const m = month, spent = sum(inMonth(S, m)), b = S.budget, left = b - spent;
    const cats = byCat(S, m);
    const last = sortedExp(inMonth(S, m)).slice(0, 4);
    const de = daysElapsed(m);
    const proj = de > 0 ? (spent / de) * daysIn(m) : 0;
    return (
      <View>
        {b > 0 ? (
          <>
            <View style={st.hero}>
              <Text style={{ fontFamily: FS, fontSize: 14, color: '#000' }}>{left >= 0 ? 'Reste à dépenser' : 'Budget dépassé de'}</Text>
              <View style={[{ alignSelf: 'flex-start', marginTop: 4, marginBottom: 12 }, left < 0 && { backgroundColor: BAD, paddingHorizontal: 10, borderRadius: 8 }]}>
                <Text style={{ fontFamily: FB, fontSize: 32, color: left < 0 ? '#fff' : '#000' }}>{fmt(Math.abs(left))}</Text>
              </View>
              <Bar pct={(spent / b) * 100} color="#000" track="rgba(0,0,0,0.18)" />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ fontFamily: FS, fontSize: 13, color: '#000' }}>Dépensé {fmt(spent)}</Text>
                <Text style={{ fontFamily: FS, fontSize: 13, color: '#000' }}>Budget {fmt(b)}</Text>
              </View>
            </View>
            {isCurrent(m) && de > 0 && spent > 0 && (
              <View style={st.card}>
                <Text style={st.note}>
                  À ce rythme, vous finirez le mois à <Text style={{ fontFamily: FB, color: C.ink }}>{fmt(proj)}</Text>
                  {proj > b ? <>, soit <Text style={{ fontFamily: FB, color: BAD }}>{fmt(proj - b)} de trop</Text>.</> : ', dans votre budget.'}
                </Text>
              </View>
            )}
          </>
        ) : (
          <View style={st.hero}>
            <Text style={{ fontFamily: FS, fontSize: 14, color: '#000' }}>Dépensé en {monthName(m, true)}</Text>
            <Text style={{ fontFamily: FB, fontSize: 32, color: '#000', marginTop: 4, marginBottom: 12 }}>{fmt(spent)}</Text>
            <TouchableOpacity onPress={() => setSheet({ type: 'budget' })} style={{ backgroundColor: '#000', alignSelf: 'flex-start', borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16 }}>
              <Text style={{ fontFamily: FB, fontSize: 14, color: '#fff' }}>Fixer mon budget du mois</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={st.h2}>Par catégorie</Text>
        <View style={st.card}>
          {!cats.length ? (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Text style={{ fontFamily: FB, fontSize: 17, color: C.ink, marginBottom: 4 }}>Aucune dépense ce mois-ci</Text>
              <Text style={[st.note, { textAlign: 'center' }]}>Touchez + pour noter votre première dépense.</Text>
            </View>
          ) : (
            cats.map(([id, v]) => {
              const c = catOf(id);
              return (
                <View key={id} style={{ marginVertical: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name={c.icon} size={18} color={c.c} style={{ marginRight: 8 }} />
                      <Text style={{ fontFamily: FR, fontSize: 14, color: C.ink }}>{c.n}</Text>
                    </View>
                    <Text style={{ fontFamily: FB, fontSize: 14, color: C.ink }}>{fmt(v)}</Text>
                  </View>
                  <Bar pct={(v / spent) * 100} color={c.c} track={C.line} />
                </View>
              );
            })
          )}
        </View>

        {last.length > 0 && (
          <>
            <Text style={st.h2}>Dernières dépenses</Text>
            <View style={st.card}>
              {last.map((e, i) => <ExpenseRow key={e.id} e={e} C={C} st={st} first={i === 0} />)}
            </View>
          </>
        )}
      </View>
    );
  };

  const renderList = () => {
    const arr = sortedExp(inMonth(S, month));
    if (!arr.length) {
      return (
        <View style={[st.card, { alignItems: 'center', paddingVertical: 28 }]}>
          <Text style={{ fontFamily: FB, fontSize: 17, color: C.ink, marginBottom: 4 }}>Rien à afficher</Text>
          <Text style={[st.note, { textAlign: 'center' }]}>Vos dépenses de {monthName(month)} apparaîtront ici.</Text>
        </View>
      );
    }
    return (
      <View>
        <Text style={st.h2}>{arr.length} dépense{arr.length > 1 ? 's' : ''} · {fmt(sum(arr))}</Text>
        <View style={st.card}>
          {arr.map((e, i) => <ExpenseRow key={e.id} e={e} C={C} st={st} first={i === 0} onDelete={() => delExpense(e.id)} />)}
        </View>
      </View>
    );
  };

  const renderBilan = () => {
    const m = month, spent = sum(inMonth(S, m));
    if (!spent) {
      return (
        <View style={[st.card, { alignItems: 'center', paddingVertical: 28 }]}>
          <Text style={{ fontFamily: FB, fontSize: 17, color: C.ink, marginBottom: 4 }}>Pas encore de bilan</Text>
          <Text style={[st.note, { textAlign: 'center' }]}>Ajoutez des dépenses pour voir vos courbes de {monthName(m)}.</Text>
        </View>
      );
    }
    const cats = byCat(S, m), top = cats[0], b = S.budget, de = Math.max(daysElapsed(m), 1);
    const prev = sum(inMonth(S, shiftMonth(m, -1)));
    const bold = { fontFamily: FB, color: C.ink };
    return (
      <View>
        <Text style={st.h2}>Bilan du mois</Text>
        <View style={st.card}>
          <Text style={[st.note, { color: C.ink }]}>
            En {monthName(m)}, vous avez dépensé <Text style={bold}>{fmt(spent)}</Text>, soit environ {fmt(spent / de)} par jour. La catégorie la plus lourde est <Text style={bold}>{catOf(top[0]).n}</Text> ({Math.round((top[1] / spent) * 100)} %).
            {b > 0 && (spent > b
              ? <> Le budget est dépassé de <Text style={{ fontFamily: FB, color: BAD }}>{fmt(spent - b)}</Text>.</>
              : <> Il vous reste <Text style={{ fontFamily: FB, color: OK }}>{fmt(b - spent)}</Text> sur votre budget.</>)}
            {prev > 0 && (() => { const d = ((spent - prev) / prev) * 100; return ` Par rapport au mois précédent : ${d >= 0 ? '+' : ''}${Math.round(d)} %.`; })()}
          </Text>
        </View>
        <Text style={st.h2}>Courbe des dépenses</Text>
        <View style={st.card}><LineChart S={S} m={m} C={C} w={cw} /></View>
        <Text style={st.h2}>Répartition</Text>
        <View style={st.card}><CatChart S={S} m={m} C={C} /></View>
        <Text style={st.h2}>Six derniers mois</Text>
        <View style={st.card}><MonthsChart S={S} m={m} C={C} w={cw} /></View>
      </View>
    );
  };

  const renderVault = () => {
    const saved = S.goals.reduce((t, g) => t + g.saved, 0);
    return (
      <View>
        <View style={st.vault}>
          <Text style={{ fontFamily: FR, fontSize: 14, color: '#bbb' }}>Total en sécurité dans mon coffre</Text>
          <Text style={{ fontFamily: FB, fontSize: 30, color: '#fff', marginTop: 2 }}>{fmt(saved)}</Text>
        </View>
        <Btn C={C} kind="or" label="Créer un objectif d'épargne" onPress={() => setSheet({ type: 'goal' })} />
        {!S.goals.length ? (
          <View style={[st.card, { marginTop: 12, alignItems: 'center', paddingVertical: 24 }]}>
            <Text style={{ fontFamily: FB, fontSize: 17, color: C.ink, marginBottom: 4 }}>Aucun objectif pour l'instant</Text>
            <Text style={[st.note, { textAlign: 'center' }]}>Donnez un nom, un montant et une date à chaque épargne : ordinateur, stock de chaussures, frais de scolarité…</Text>
          </View>
        ) : (
          <>
            <Text style={st.h2}>Mes objectifs</Text>
            {S.goals.map((g) => {
              const p = Math.min(100, (g.saved / g.target) * 100), rest = Math.max(g.target - g.saved, 0);
              let info;
              const bold = { fontFamily: FB, color: C.ink };
              if (rest === 0) info = <Text>Objectif atteint !</Text>;
              else if (g.deadline) {
                const now = new Date(), dl = new Date(g.deadline + 'T12:00:00');
                const months = Math.max(1, (dl.getFullYear() - now.getFullYear()) * 12 + dl.getMonth() - now.getMonth() + (dl.getDate() >= now.getDate() ? 1 : 0));
                info = dl < now
                  ? <Text>Date dépassée. Reportez-la ou versez le reste.</Text>
                  : <Text>Mettez de côté <Text style={bold}>{fmt(rest / months)}</Text> par mois pendant {months} mois.</Text>;
              } else info = <Text>Il reste {fmt(rest)} à épargner.</Text>;
              return (
                <View key={g.id} style={st.card}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                    <Text style={{ fontFamily: FB, fontSize: 17, color: C.ink, flex: 1 }}>{g.name}</Text>
                    <Text style={st.note}>{Math.round(p)} %</Text>
                  </View>
                  <Bar pct={p} color={ORANGE} track={C.line} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text style={{ fontFamily: FS, fontSize: 13, color: C.ink }}>{fmt(g.saved)}</Text>
                    <Text style={{ fontFamily: FS, fontSize: 13, color: C.ink }}>{fmt(g.target)}</Text>
                  </View>
                  <Text style={[st.note, { marginTop: 10, marginBottom: 12 }]}>
                    {info}{g.deadline ? ` Échéance : ${dateLong(g.deadline)}.` : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    <Btn C={C} small label="Verser" onPress={() => setSheet({ type: 'deposit', id: g.id })} style={{ marginRight: 8, marginBottom: 8 }} />
                    <Btn C={C} small kind="ghost" label="Retirer" onPress={() => setSheet({ type: 'withdraw', id: g.id })} style={{ marginRight: 8, marginBottom: 8 }} />
                    <Btn C={C} small kind="ghost" label="Supprimer" onPress={() => delGoal(g.id)} style={{ marginBottom: 8 }} />
                  </View>
                </View>
              );
            })}
          </>
        )}
      </View>
    );
  };

  const renderAdvice = () => {
    const items = [
      ['conseil', 'bulb-outline', 'Me conseiller', 'Analyse de mes dépenses du mois'],
      ['business', 'rocket-outline', 'Business à réaliser', 'Des idées adaptées à mon budget'],
      ['marketing', 'megaphone-outline', 'Stratégies marketing', 'Pour mon business de chaussures'],
    ];
    return (
      <View>
        {items.map(([k, ic, t, sub]) => (
          <TouchableOpacity key={k} activeOpacity={0.8} onPress={() => runAdvice(k)} style={[st.card, { flexDirection: 'row', alignItems: 'center', marginBottom: 10 }]}>
            <IconDot icon={ic} color="#000" bg={ORANGE} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontFamily: FB, fontSize: 16, color: C.ink }}>{t}</Text>
              <Text style={{ fontFamily: FR, fontSize: 13, color: C.mut, marginTop: 2 }}>{sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.mut} />
          </TouchableOpacity>
        ))}
        {out.loading && (
          <View style={[st.card, { flexDirection: 'row', alignItems: 'center' }]}>
            <ActivityIndicator color={ORANGE} />
            <Text style={{ fontFamily: FR, fontSize: 15, color: C.mut, marginLeft: 10 }}>Analyse en cours…</Text>
          </View>
        )}
        {!out.loading && out.items && (
          <View style={st.card}>
            <Text style={{ fontFamily: FB, fontSize: 17, color: C.ink, marginBottom: 10 }}>{out.title}</Text>
            {out.items.map((x, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 8 }}>
                <Text style={{ fontFamily: FB, fontSize: 15, color: ORANGE, marginRight: 8 }}>•</Text>
                <Text style={{ flex: 1, fontFamily: FR, fontSize: 15, lineHeight: 22, color: C.ink }}>{x}</Text>
              </View>
            ))}
            <Text style={{ fontFamily: FR, fontSize: 12, color: C.mut, marginTop: 6 }}>Conseils calculés sur votre téléphone à partir de vos dépenses. Aucune connexion nécessaire.</Text>
          </View>
        )}
      </View>
    );
  };

  const screens = { home: renderHome, list: renderList, bilan: renderBilan, vault: renderVault, advice: renderAdvice };
  const goalOf = (id) => S.goals.find((g) => g.id === id);

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={st.wrap}>
        {/* En-tête */}
        <View style={st.top}>
          <View style={st.topRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 28, height: 28, backgroundColor: ORANGE, marginRight: 10 }} />
              <Text style={{ fontFamily: FB, fontSize: 20, color: '#fff' }}>Mes dépenses</Text>
            </View>
            <Btn C={C} kind="or" small label="Budget" onPress={() => setSheet({ type: 'budget' })} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
            <TouchableOpacity style={st.monthBtn} onPress={() => setMonth(shiftMonth(month, -1))} accessibilityLabel="Mois précédent">
              <Ionicons name="chevron-back" size={18} color="#fff" />
            </TouchableOpacity>
            <Text style={{ flex: 1, textAlign: 'center', fontFamily: FB, fontSize: 16, color: '#fff' }}>{cap(monthName(month))}</Text>
            <TouchableOpacity style={st.monthBtn} onPress={() => setMonth(shiftMonth(month, 1))} accessibilityLabel="Mois suivant">
              <Ionicons name="chevron-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Contenu */}
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 170 }} showsVerticalScrollIndicator={false}>
          {screens[tab]()}
        </ScrollView>

        {/* Bouton + */}
        {tab !== 'vault' && tab !== 'advice' && (
          <TouchableOpacity activeOpacity={0.85} style={st.fab} onPress={() => setSheet({ type: 'add' })} accessibilityLabel="Ajouter une dépense">
            <Ionicons name="add" size={32} color="#000" />
          </TouchableOpacity>
        )}

        {/* Navigation du bas */}
        <View style={st.nav}>
          {TABS.map(([id, icon, label]) => {
            const on = tab === id;
            return (
              <TouchableOpacity key={id} style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }} onPress={() => setTab(id)}>
                <View style={[{ paddingHorizontal: 14, paddingVertical: 2, borderRadius: 12 }, on && { backgroundColor: ORANGE }]}>
                  <Ionicons name={on ? icon : icon + '-outline'} size={22} color={on ? '#000' : C.mut} />
                </View>
                <Text style={{ fontFamily: FS, fontSize: 11, color: on ? C.ink : C.mut, marginTop: 2 }}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Fenêtres */}
      {sheet?.type === 'add' && <AddSheet C={C} st={st} month={month} defaultCat={catSel} onSave={addExpense} onClose={closeSheet} />}
      {sheet?.type === 'budget' && <BudgetSheet C={C} st={st} current={S.budget} onSave={saveBudget} onClose={closeSheet} />}
      {sheet?.type === 'goal' && <GoalSheet C={C} st={st} onSave={addGoal} onClose={closeSheet} />}
      {(sheet?.type === 'deposit' || sheet?.type === 'withdraw') && goalOf(sheet.id) && (
        <MoveSheet C={C} st={st} goal={goalOf(sheet.id)} sign={sheet.type === 'deposit' ? 1 : -1} onSave={(d) => moveGoal(sheet.id, d)} onClose={closeSheet} />
      )}
    </View>
  );
}

/* ---------- Styles ---------- */
function makeStyles(C) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    wrap: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', backgroundColor: C.bg },
    top: { backgroundColor: '#000', paddingHorizontal: 18, paddingBottom: 16, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 54 },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    monthBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#444', alignItems: 'center', justifyContent: 'center' },
    h2: { fontFamily: FB, fontSize: 20, color: C.ink, marginTop: 22, marginBottom: 10 },
    card: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12 },
    hero: { backgroundColor: ORANGE, borderRadius: 16, padding: 20, marginBottom: 12 },
    vault: { backgroundColor: '#000', borderRadius: 16, padding: 20, marginBottom: 12 },
    note: { fontFamily: FR, fontSize: 14, color: C.mut, lineHeight: 21 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.line },
    chip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: C.line, marginRight: 8, marginBottom: 8 },
    input: { fontFamily: FR, fontSize: 16, color: C.ink, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12 },
    sheet: { backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 28, maxHeight: '90%', width: '100%', maxWidth: 520, alignSelf: 'center' },
    fab: { position: 'absolute', right: 16, bottom: 90, width: 58, height: 58, borderRadius: 29, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
    nav: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6, paddingBottom: Platform.OS === 'ios' ? 26 : 18, paddingHorizontal: 4 },
  });
}