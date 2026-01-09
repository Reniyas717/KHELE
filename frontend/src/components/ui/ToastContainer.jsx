import Toast from './Toast';

const ToastContainer = ({ toasts, removeToast }) => {
    return (
        <div className="fixed top-20 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
            {toasts.map((toast) => (
                <div key={toast.id} className="pointer-events-auto">
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => removeToast(toast.id)}
                        duration={toast.duration}
                    />
                </div>
            ))}
        </div>
    );
};

export default ToastContainer;
