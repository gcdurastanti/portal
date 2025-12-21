import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useNotification } from '../contexts/NotificationContext';

export function GooglePhotosCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { showNotification } = useNotification();

    useEffect(() => {
        const code = searchParams.get('code');
        if (!code) {
            showNotification('No authorization code found', 'error');
            navigate('/');
            return;
        }

        const exchangeCode = async () => {
            try {
                await api.post('/photos/auth/callback', { code });
                showNotification('Successfully connected to Google Photos', 'success');
                navigate('/');
            } catch (error) {
                console.error('Auth Error:', error);
                showNotification('Failed to connect to Google Photos', 'error');
                navigate('/');
            }
        };

        exchangeCode();
    }, [searchParams, navigate, showNotification]);

    return (
        <div className="auth-callback">
            <h2>Connecting to Google Photos...</h2>
        </div>
    );
}
