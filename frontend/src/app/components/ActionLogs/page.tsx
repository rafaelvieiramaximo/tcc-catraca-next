import { useAppAuth } from '../../contexts/app-auth-context';
import ActionLogs from '../../components/ActionLogs/page';
import { UsuarioCompleto } from '../../services/database-service';

interface ActionLogsPageProps {
    user?: UsuarioCompleto | null;
    onLogout: () => void;
}
export default function ActionLogsPage({ user, onLogout }: ActionLogsPageProps) {
    const { currentUser, handleLogout } = useAppAuth();

    return <div>ActionLogsPage</div>;
}