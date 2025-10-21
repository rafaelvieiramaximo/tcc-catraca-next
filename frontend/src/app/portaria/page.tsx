// app/portaria/page.tsx
'use client';

import { useAppAuth } from '../contexts/app-auth-context';
import RegisterEntry from '../components/RegisterEntry/page';
import LoadingScreen from '../components/loadingScreen';

export default function PortariaPage() {
    const { currentUser, handleLogout, loading } = useAppAuth();

    if (loading) {
        return <LoadingScreen />;
    }

    if (currentUser?.tipo !== 'PORTARIA') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
                <div className="text-red-500 text-lg mb-4">Erro: Usuário não autenticado</div>
                <button
                    onClick={() => window.location.href = '/'}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                    Voltar ao Login
                </button>
            </div>
        );
    } else {

        return <RegisterEntry user={currentUser} onLogout={handleLogout} />;
    }

}