import { Redirect } from 'expo-router';
import { LoadingView } from '../components/Ui';
import { useSession } from '../lib/session';

export default function Index() {
  const { session, loading } = useSession();
  if (loading) return <LoadingView />;
  return <Redirect href={session ? '/(tabs)/jobs' : '/login'} />;
}
