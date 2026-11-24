import { useRouter } from 'expo-router';
import { Header, Notice } from '../components/ui';
import { t } from '../i18n';

export default function Notifications() {
  const router = useRouter();
  return <>
    <Header title={t.notifications} back={() => router.back()} />
    <Notice message={t.noNotifications} />
  </>;
}
