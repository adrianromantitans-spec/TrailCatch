import { Ionicons } from '@expo/vector-icons';
import { Directory, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import { useNavigation, usePreventRemove, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import {
  ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import type { TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmailAuthForm } from '../components/EmailAuthForm';
import { PressFeedback as Pressable } from '../components/PressFeedback';
import { useToast } from '../components/Toast';
import { Button, Header, Notice, onBrand, side, styles, usePalette } from '../components/ui';
import { deleteOutings } from '../db/diary';
import { t } from '../i18n';
import { backend, useSession } from '../services/backend';
import { removeAllPhotos } from '../services/photos';
import {
  AvatarPermissionError, discardAvatar, pickAvatar, profileUsernameAvailable, readProfileEditor,
  removeOwnedAvatar, uploadAvatar, usernamePattern,
} from '../services/profileEditor';
import type { AvatarSource, ProfileDraft } from '../services/profileEditor';
import { unregisterPush } from '../services/push';

type UsernameState = { value: string; result: 'available' | 'taken' | 'error' };
type ModalType = 'avatar' | 'delete';
type ScrollInstance = ComponentRef<typeof ScrollView>;
type FocusHandle = Parameters<ScrollInstance['scrollResponderScrollNativeHandleToKeyboard']>[0];
const maxBio = 150;

function ProfileField({ label, hint, error, count, ...props }: TextInputProps & {
  label: string; hint?: string; error?: string; count?: string;
}) {
  const p = usePalette();
  const [focused, setFocused] = useState(false);
  return <View style={layout.field}>
    <View style={layout.fieldHeading}>
      <Text style={[styles.fieldLabel, { color: focused ? p.accent : p.ink }]}>{label}</Text>
      {!!count && <Text style={{ color: error ? p.danger : p.muted }}>{count}</Text>}
    </View>
    <TextInput {...props} accessibilityLabel={label} placeholderTextColor={p.muted} keyboardAppearance="light"
      onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
      onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
      style={[styles.input, { color: p.ink, backgroundColor: p.field, borderColor: error ? p.danger : focused ? p.accent : p.line },
        props.multiline && layout.bio]} />
    {!!(error || hint) && <Text accessibilityLiveRegion="polite" style={[layout.help, { color: error ? p.danger : p.muted }]}>{error || hint}</Text>}
  </View>;
}

export default function Account() {
  const router = useRouter();
  const { session, loading, profileSetup } = useSession();
  const { bottom } = useSafeAreaInsets();
  if (session && profileSetup !== 'checking') return <ProfileEditor key={session.user.id} userId={session.user.id}
    admin={session.user.app_metadata.role === 'admin'} onboarding={profileSetup === 'required'} />;

  return <>
    <Header title={t.account} back={() => router.canGoBack() ? router.back() : router.replace('/')} />
    {!backend ? <Notice message={t.backendUnavailable} /> : loading || profileSetup === 'checking' ? <Notice message={t.loading} loading /> :
      <ScrollView style={styles.screen} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
        contentContainerStyle={[styles.content, { paddingBottom: bottom + side }]}><EmailAuthForm /></ScrollView>}
  </>;
}

function ProfileEditor({ userId, admin, onboarding }: { userId: string; admin: boolean; onboarding: boolean }) {
  const router = useRouter();
  const showToast = useToast();
  const navigation = useNavigation();
  const db = useSQLiteContext();
  const { resetGuest, finishProfileSetup } = useSession();
  const p = usePalette();
  const inset = useSafeAreaInsets();
  const scroll = useRef<ScrollInstance>(null);
  const focused = useRef<FocusHandle | undefined>(undefined);
  const ownedDraft = useRef<string | undefined>(undefined);
  const queuedPhoto = useRef<AvatarSource | undefined>(undefined);
  const mounted = useRef(false);
  const lock = useRef(false);

  const [baseline, setBaseline] = useState<ProfileDraft>();
  const [draft, setDraft] = useState<ProfileDraft>();
  const [ready, setReady] = useState(false);
  const [localAvatar, setLocalAvatar] = useState<string>();
  const [failedAvatar, setFailedAvatar] = useState<string>();
  const [usernameState, setUsernameState] = useState<UsernameState>();
  const [usernameRetry, setUsernameRetry] = useState(0);
  const [saveBusy, setSaveBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [picking, setPicking] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [modal, setModal] = useState<ModalType>();
  const [deleteInput, setDeleteInput] = useState('');

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; discardAvatar(ownedDraft.current); };
  }, []);

  useEffect(() => {
    const request = new AbortController();
    void readProfileEditor(userId, request.signal).then((result) => {
      if (request.signal.aborted) return;
      setReady(result.ready);
      setBaseline(result.draft);
      setDraft(result.draft);
      setFailed(false);
    }).catch(() => { if (!request.signal.aborted) setFailed(true); });
    return () => request.abort();
  }, [userId, retry]);

  useEffect(() => {
    function scrollFocusedField() {
      if (focused.current != null) scroll.current?.scrollResponderScrollNativeHandleToKeyboard(focused.current, 16, true);
    }
    const show = Keyboard.addListener('keyboardDidShow', () => { setKeyboard(true); scrollFocusedField(); });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const name = draft?.display_name.trim() ?? '';
  const username = draft?.username.trim().toLowerCase() ?? '';
  const nameError = draft && !name ? t.profileNameRequired : '';
  const usernameChanged = username !== (baseline?.username ?? '');
  const validateUsername = ready && !!username && usernameChanged && usernamePattern.test(username);
  const checked = usernameState?.value === username ? usernameState.result : undefined;

  useEffect(() => {
    if (!validateUsername) return;
    const request = new AbortController();
    const timer = setTimeout(() => {
      void profileUsernameAvailable(username, request.signal).then((available) => {
        if (!request.signal.aborted) setUsernameState({ value: username, result: available ? 'available' : 'taken' });
      }).catch(() => { if (!request.signal.aborted) setUsernameState({ value: username, result: 'error' }); });
    }, usernameRetry ? 0 : 300);
    return () => { clearTimeout(timer); request.abort(); };
  }, [username, validateUsername, usernameRetry]);

  const usernameError = ready && (username ? !usernamePattern.test(username) ? t.profileUsernameRules
    : usernameChanged && checked === 'taken' ? t.profileUsernameTaken : usernameChanged && checked === 'error' ? t.profileUsernameCheckError : ''
    : usernameChanged || onboarding ? t.profileUsernameRequired : '');
  const bioError = (draft?.bio.length ?? 0) > maxBio ? t.profileBioLimit : '';
  const dirty = !!draft && !!baseline && (name !== baseline.display_name.trim() || usernameChanged ||
    draft.bio !== baseline.bio || draft.avatar_url !== baseline.avatar_url || !!localAvatar);
  const blocked = saveBusy || picking || leaving;
  const canSave = !!draft && (dirty || onboarding) && !blocked && !nameError && !usernameError && !bioError &&
    (!validateUsername || checked === 'available');
  const avatar = localAvatar ?? draft?.avatar_url;

  usePreventRemove(dirty && !onboarding && !leaving, ({ data }) => {
    if (saveBusy || picking) return;
    Alert.alert(t.profileDiscardTitle, t.profileDiscardBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.profileDiscard, style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  function change<K extends keyof ProfileDraft>(field: K, value: ProfileDraft[K]) {
    setDraft((current) => current && { ...current, [field]: value });
    setMessage(undefined);
  }

  async function choosePhoto(source: AvatarSource) {
    if (lock.current) return;
    lock.current = true; setPicking(true); setModal(undefined); setMessage(undefined);
    try {
      const uri = await pickAvatar(source);
      if (!uri) return;
      if (!mounted.current) { discardAvatar(uri); return; }
      discardAvatar(ownedDraft.current);
      ownedDraft.current = uri;
      setLocalAvatar(uri);
      setFailedAvatar(undefined);
    } catch (error) {
      if (!mounted.current) return;
      if (error instanceof AvatarPermissionError) {
        Alert.alert(error.source === 'camera' ? t.profileCameraDenied : t.profileGalleryDenied, undefined,
          error.canAskAgain ? [{ text: t.cancel, style: 'cancel' }] : [
            { text: t.cancel, style: 'cancel' },
            { text: t.settings, onPress: () => { void Linking.openSettings().catch(() => {}); } },
          ]);
      } else setMessage({ text: t.profilePhotoError, error: true });
    } finally { lock.current = false; if (mounted.current) setPicking(false); }
  }

  function selectPhoto(source: AvatarSource) {
    if (Platform.OS === 'ios') {
      queuedPhoto.current = source;
      setModal(undefined);
    } else void choosePhoto(source);
  }

  function removePhoto() {
    discardAvatar(ownedDraft.current);
    ownedDraft.current = undefined;
    setLocalAvatar(undefined); setModal(undefined);
    change('avatar_url', null);
  }

  async function save(skip = false) {
    if (!backend || lock.current || !draft || (!skip && !canSave)) return;
    lock.current = true; setSaveBusy(true); setMessage(undefined);
    let uploaded: string | undefined;
    let committed = false;
    let avatarFailed = false;
    try {
      if (!skip && localAvatar) {
        setUploading(true);
        try { uploaded = await uploadAvatar(userId, localAvatar); }
        catch { avatarFailed = true; throw new Error('Avatar upload failed'); }
        finally { setUploading(false); }
      }
      const next = { ...draft, display_name: name, username, avatar_url: uploaded ?? draft.avatar_url };
      const changes = skip ? { onboarding_complete: true } : {
        display_name: next.display_name, bio: next.bio, avatar_url: next.avatar_url,
        ...(ready && { username: next.username || null }),
        ...(onboarding && { onboarding_complete: true }),
      };
      const result = await backend.from('profiles').update(changes).eq('id', userId).select('id').single();
      if (result.error) {
        if (uploaded && result.status >= 400 && result.status < 500) await removeOwnedAvatar(userId, uploaded).catch(() => {});
        if (result.error.code === '23505') setUsernameState({ value: username, result: 'taken' });
        throw result.error;
      }
      committed = true;
      if (!skip) {
        discardAvatar(ownedDraft.current);
        ownedDraft.current = undefined;
        setLocalAvatar(undefined); setBaseline(next); setDraft(next);
        if (baseline?.avatar_url && baseline.avatar_url !== next.avatar_url) {
          void removeOwnedAvatar(userId, baseline.avatar_url).catch(() => {});
        }
      }
      if (onboarding) {
        Keyboard.dismiss();
        finishProfileSetup(userId);
        router.replace('/');
        if (!skip) Alert.alert(t.accountSaved);
      } else setMessage({ text: t.accountSaved });
    } catch {
      if (!committed && mounted.current) setMessage({ text: avatarFailed ? t.profileAvatarUploadError : t.accountError, error: true });
    } finally {
      lock.current = false;
      if (mounted.current) setSaveBusy(false);
    }
  }

  async function leave(remove: boolean) {
    if (!backend || lock.current) return;
    lock.current = true; setSaveBusy(true); setLeaving(true); setMessage(undefined);
    try {
      if (remove) {
        const result = await backend.functions.invoke('delete-account', { method: 'POST' });
        if (result.error) throw result.error;
        try {
          await deleteOutings(db, false);
          removeAllPhotos();
          const exports = new Directory(Paths.cache, 'trailcatch-exports');
          if (exports.exists) exports.delete();
        } catch { Alert.alert(t.profileLocalDeleteError); }
        await backend.auth.signOut({ scope: 'local' });
      } else {
        await unregisterPush();
        const result = await backend.auth.signOut();
        if (result.error) throw result.error;
      }
      Keyboard.dismiss();
      resetGuest();
      router.replace('/welcome');
      if (remove) showToast(t.accountDeleted);
    } catch {
      setLeaving(false); setMessage({ text: t.accountError, error: true });
    } finally { lock.current = false; if (mounted.current) setSaveBusy(false); }
  }

  function confirmSignOut() {
    if (!dirty) { void leave(false); return; }
    Alert.alert(t.profileDiscardTitle, t.profileDiscardBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.signOut, style: 'destructive', onPress: () => void leave(false) },
    ]);
  }

  const focusField: TextInputProps['onFocus'] = (event) => {
    focused.current = event.target;
    if (Keyboard.isVisible() && event.target != null) scroll.current?.scrollResponderScrollNativeHandleToKeyboard(event.target, 16, true);
  };
  const blurField = () => { focused.current = undefined; };
  const avatarInitials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toLocaleUpperCase()).join('') || '?';

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.screen, { backgroundColor: p.bg }]}>
    <Header title={onboarding ? t.profileCreateTitle : t.editProfile}
      back={onboarding ? undefined : () => router.canGoBack() ? router.back() : router.replace('/')} />
    <ScrollView ref={scroll} style={styles.screen} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="never"
      contentContainerStyle={layout.scroll}>
      {!draft ? <Notice message={failed ? t.loadError : t.loading} loading={!failed}
        retry={failed ? () => { setFailed(false); setRetry((value) => value + 1); } : undefined} /> :
        <View style={layout.form}>
          <Pressable accessibilityRole="button" accessibilityLabel={t.profileChangePhoto} accessibilityState={{ disabled: blocked || !ready }}
            disabled={blocked || !ready} onPress={() => { Keyboard.dismiss(); setModal('avatar'); }}
            style={[layout.avatarRing, { borderColor: p.accent, backgroundColor: p.soft }]}>
            {avatar && failedAvatar !== avatar
              ? <Image source={{ uri: avatar }} style={layout.avatar} cachePolicy="memory-disk" onError={() => setFailedAvatar(avatar)} />
              : <Text style={[layout.initials, { color: p.accent }]}>{avatarInitials}</Text>}
            {uploading && <View style={layout.avatarLoading}><ActivityIndicator color={onBrand} accessibilityLabel={t.loading} /></View>}
            <View style={[layout.camera, { backgroundColor: p.accent, borderColor: p.surface }]}>
              <Ionicons name="camera-outline" size={19} color={onBrand} />
            </View>
          </Pressable>
          {!ready && <Text style={[layout.help, { color: p.muted }]}>{t.profileSetupUnavailable}</Text>}
          <ProfileField label={t.displayName} hint={t.profileNameHelp} value={draft.display_name} error={nameError || undefined}
            onChangeText={(value) => change('display_name', value)} maxLength={80} autoComplete="name" editable={!blocked}
            onFocus={focusField} onBlur={blurField} />
          {ready && <>
            <ProfileField label={t.profileUsername} hint={validateUsername && !checked ? t.profileUsernameChecking :
              validateUsername && checked === 'available' ? t.profileUsernameFree : t.profileUsernameRules}
              error={usernameError || undefined} value={draft.username} maxLength={24} autoCapitalize="none" autoCorrect={false}
              autoComplete="username" editable={!blocked} onFocus={focusField} onBlur={blurField}
              onChangeText={(value) => { setUsernameState(undefined); change('username', value.toLowerCase().replace(/^@/, '')); }} />
            {validateUsername && checked === 'error' && <Button label={t.retry} onPress={() => {
              setUsernameState(undefined); setUsernameRetry((value) => value + 1);
            }} />}
          </>}
          <ProfileField label={t.bio} hint={t.profileBioHelp} value={draft.bio} error={bioError || undefined}
            count={`${draft.bio.length}/${maxBio}`} multiline maxLength={maxBio} editable={!blocked} onFocus={focusField} onBlur={blurField}
            onChangeText={(value) => change('bio', value)} />
          {!onboarding && <View style={[layout.actions, { borderColor: p.line }]}>
            {admin && <Button label={t.reports} disabled={blocked} onPress={() => router.push('/reports')} />}
            <Button label={t.signOut} icon="log-out-outline" disabled={blocked} onPress={confirmSignOut} />
            <Button label={t.removeAccount} danger disabled={blocked} onPress={() => { Keyboard.dismiss(); setDeleteInput(''); setModal('delete'); }} />
          </View>}
        </View>}
    </ScrollView>
    <View style={[layout.footer, { paddingBottom: keyboard ? 8 : Math.max(12, inset.bottom), borderColor: p.line, backgroundColor: p.surface }]}>
      {message && <Text style={{ color: message.error ? p.danger : p.accent }} accessibilityLiveRegion="polite">{message.text}</Text>}
      <View style={[layout.footerActions, onboarding && layout.onboardingActions]}>
        {onboarding && <Button label={t.profileSkip} stretch disabled={blocked || !draft} onPress={() => void save(true)} />}
        <Pressable cssInterop={false} accessibilityRole="button" accessibilityState={{ disabled: !canSave, busy: saveBusy }}
          disabled={!canSave} onPress={() => void save()}
          style={({ pressed }) => [styles.button, styles.primaryButton, onboarding && layout.save,
            { backgroundColor: !canSave ? '#465F55' : pressed ? '#1C4938' : p.accent, borderColor: p.accent }]}>
          {saveBusy && <ActivityIndicator color={onBrand} />}
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={layout.saveText}>
            {saveBusy ? t.saving : message?.text === t.profileAvatarUploadError ? t.retry : t.saveProfile}
          </Text>
        </Pressable>
      </View>
    </View>

    <Modal visible={!!modal} transparent animationType="slide" onRequestClose={() => setModal(undefined)} onDismiss={() => {
      const source = queuedPhoto.current;
      queuedPhoto.current = undefined;
      if (source) void choosePhoto(source);
    }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={layout.shade}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={t.cancel}
          onPress={() => setModal(undefined)} />
        <ScrollView accessibilityViewIsModal keyboardShouldPersistTaps="handled" style={[layout.sheet, { backgroundColor: p.surface }]}
          contentContainerStyle={[layout.sheetActions, { paddingBottom: Math.max(16, inset.bottom) }]}>
          <Text accessibilityRole="header" style={[styles.section, { color: p.ink }]}>{modal === 'delete' ? t.removeAccount : t.profileChangePhoto}</Text>
          {modal === 'avatar' && <>
            <Button label={t.takePhoto} icon="camera-outline" onPress={() => selectPhoto('camera')} />
            <Button label={t.profileChooseGallery} icon="images-outline" onPress={() => selectPhoto('gallery')} />
            {!!avatar && <Button label={t.profileRemovePhoto} icon="trash-outline" danger onPress={removePhoto} />}
          </>}
          {modal === 'delete' && <>
            <Text style={{ color: p.ink }}>{t.profileDeleteExplanation}</Text>
            <ProfileField label={t.profileDeleteInstruction} value={deleteInput} autoCapitalize="characters"
              autoCorrect={false} onChangeText={setDeleteInput} />
            <Button label={t.removeAccount} danger disabled={deleteInput.trim() !== t.profileDeleteWord}
              onPress={() => { setModal(undefined); void leave(true); }} />
          </>}
          <Button label={t.cancel} onPress={() => setModal(undefined)} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  </KeyboardAvoidingView>;
}

const layout = StyleSheet.create({
  scroll: { padding: side },
  form: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 16 },
  field: { gap: 6 },
  fieldHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  help: { fontSize: 13 },
  bio: { minHeight: 112, textAlignVertical: 'top' },
  avatarRing: { width: 112, height: 112, alignSelf: 'center', borderRadius: 56, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatar: { width: 104, height: 104, borderRadius: 52 },
  initials: { fontSize: 32, fontWeight: '700' },
  camera: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, position: 'absolute', bottom: -3, right: -3,
    alignItems: 'center', justifyContent: 'center' },
  avatarLoading: { position: 'absolute', top: 4, bottom: 4, left: 4, right: 4, borderRadius: 52, backgroundColor: '#183C31BB',
    alignItems: 'center', justifyContent: 'center' },
  actions: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16, gap: 8, marginTop: 8 },
  footer: { paddingTop: 8, paddingHorizontal: side, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  footerActions: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 8 },
  onboardingActions: { flexDirection: 'row', alignItems: 'center' },
  save: { flex: 1, flexGrow: 1, flexBasis: 0, minWidth: 0 },
  saveText: { color: onBrand, fontWeight: '700', flexShrink: 1 },
  shade: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#14251D80' },
  sheet: { flexGrow: 0, flexShrink: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetActions: { padding: side, gap: 8 },
});
