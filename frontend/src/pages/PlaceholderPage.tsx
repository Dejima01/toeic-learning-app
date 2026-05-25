import { MainLayout } from '../components/MainLayout';

interface Props {
  title: string;
}

export default function PlaceholderPage({ title }: Props) {
  return (
    <MainLayout title={title} showBack>
      <div className="flex flex-col items-center justify-center px-6 py-16 text-gray-400">
        <p>実装予定</p>
      </div>
    </MainLayout>
  );
}
