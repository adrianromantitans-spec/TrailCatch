import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PeopleResults } from '../components/PeopleResults';
import { Field, Header, Notice, side, styles } from '../components/ui';
import { t } from '../i18n';
import { backend } from '../services/backend';

export default function People() {
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  return <>
    <Header title={t.users} back={() => router.canGoBack() ? router.back() : router.replace('/explore')} />
    {!backend ? <Notice message={t.backendUnavailable} /> : <>
      <View style={styles.content}>
        <Field label={t.searchUsers} value={query} onChangeText={setQuery} maxLength={80} returnKeyType="search" />
      </View>
      <PeopleResults query={query.trim()} bottom={bottom + side} />
    </>}
  </>;
}
