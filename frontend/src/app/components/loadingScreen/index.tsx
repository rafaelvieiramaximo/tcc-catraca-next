interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({ message = "Carregando..." }: LoadingScreenProps) {
  return (
    <div style={{
      flex: 1,
      backgroundColor: "#F5F5F5",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh"
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: "48px",
          height: "48px",
          border: "4px solid #E9ECEF",
          borderTop: "4px solid #4A90A4",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
          margin: "0 auto 16px auto"
        }}></div>
        <p style={{
          color: "#6C757D",
          fontSize: "16px",
          fontWeight: "500"
        }}>{message}</p>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}