import { UsuarioCompleto } from '@/app/services/database-service';
import { useAppAuth } from '../../contexts/app-auth-context';

interface UserManagementPageProps {
    user?: UsuarioCompleto | null;
    onLogout: () => void;
}
export default function UserManagementPage(userManagementPageProps: UserManagementPageProps) {
    const { user, onLogout } = userManagementPageProps;

    return (
       <div>UserManagementPage</div>
    );
}