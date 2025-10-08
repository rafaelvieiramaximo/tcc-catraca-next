import { UsuarioCompleto } from '@/app/services/database-service';
import { useAppAuth } from '../../contexts/app-auth-context';

interface EntryLogsPageProps {
    user?: UsuarioCompleto  | null;
    onLogout: () => void;
}
export default function EntryLogsPage({ user, onLogout }: EntryLogsPageProps) {

    return <div>EntryLogsPage</div>;

    
}