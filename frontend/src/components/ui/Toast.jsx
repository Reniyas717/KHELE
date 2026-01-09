import { useEffect } from 'react';
import { IoClose, IoCheckmarkCircle, IoWarning, IoInformationCircle, IoCloseCircle } from 'react-icons/io5';

const Toast = ({ message, type = 'info', onClose, duration = 3000 }) => {
    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [duration, onClose]);

    const typeStyles = {
        success: {
            bg: 'bg-green-500/90',
            border: 'border-green-400',
            icon: <IoCheckmarkCircle className="w-6 h-6" />,
        },
        error: {
            bg: 'bg-red-500/90',
            border: 'border-red-400',
            icon: <IoCloseCircle className="w-6 h-6" />,
        },
        warning: {
            bg: 'bg-yellow-500/90',
            border: 'border-yellow-400',
            icon: <IoWarning className="w-6 h-6" />,
        },
        info: {
            bg: 'bg-blue-500/90',
            border: 'border-blue-400',
            icon: <IoInformationCircle className="w-6 h-6" />,
        },
    };

    const style = typeStyles[type] || typeStyles.info;

    return (
        <div
            className={`
        flex items-center gap-3 px-4 py-3 rounded-xl border-2 shadow-2xl
        backdrop-blur-xl text-white font-body text-sm md:text-base
        animate-slide-in-right min-w-[280px] max-w-md
        ${style.bg} ${style.border}
      `}
        >
            <div className="flex-shrink-0">{style.icon}</div>
            <p className="flex-1 font-medium">{message}</p>
            <button
                onClick={onClose}
                className="flex-shrink-0 hover:bg-white/20 rounded-lg p-1 transition-colors"
                aria-label="Close notification"
            >
                <IoClose className="w-5 h-5" />
            </button>
        </div>
    );
};

export default Toast;
