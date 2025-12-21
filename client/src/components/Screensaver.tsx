import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { useNotification } from '../contexts/NotificationContext';

interface MediaItem {
    id: string;
    baseUrl: string;
    mimeType: string;
}

export function Screensaver({ active }: { active: boolean }) {
    const [photos, setPhotos] = useState<MediaItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(false);
    const { showNotification } = useNotification();
    const intervalRef = useRef<number | null>(null);

    // Check status and fetch photos
    useEffect(() => {
        if (!active) return;

        const checkStatus = async () => {
            try {
                const status = await api.get<{ isAuthenticated: boolean }>('/photos/status');
                setIsAuthenticated(status.isAuthenticated);

                if (status.isAuthenticated) {
                    fetchPhotos();
                }
            } catch (error) {
                console.error('Failed to check status:', error);
            }
        };

        checkStatus();
    }, [active]);

    const fetchPhotos = async () => {
        setLoading(true);
        try {
            const data = await api.get<{ mediaItems: MediaItem[] }>('/photos/photos');
            if (data.mediaItems && data.mediaItems.length > 0) {
                setPhotos(data.mediaItems);
            }
        } catch (error) {
            console.error('Failed to fetch photos:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = async () => {
        try {
            const { url } = await api.get<{ url: string }>('/photos/auth');
            window.location.href = url;
        } catch (error) {
            showNotification('Failed to initiate connection', 'error');
        }
    };

    // Slideshow logic
    useEffect(() => {
        if (!active || photos.length === 0) return;

        intervalRef.current = window.setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % photos.length);
        }, 10000); // 10 seconds per photo

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [active, photos]);

    if (!active) return null;

    return (
        <div className="screensaver">
            {isAuthenticated ? (
                photos.length > 0 ? (
                    <div className="photo-container">
                        {photos.map((photo, index) => (
                            <img
                                key={photo.id}
                                src={`${photo.baseUrl}=w1920-h1080`}
                                alt="Screensaver"
                                className={`screensaver-photo ${index === currentIndex ? 'visible' : 'hidden'}`}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="screensaver-message">
                        {loading ? 'Loading photos...' : 'No photos found in selected album'}
                    </div>
                )
            ) : (
                <div className="screensaver-message">
                    <h2>Connect Google Photos</h2>
                    <p>Display your family memories here</p>
                    <button onClick={handleConnect} className="auth-button">
                        Connect
                    </button>
                </div>
            )}
            <div className="screensaver-overlay" />
        </div>
    );
}
