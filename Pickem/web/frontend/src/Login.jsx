import React from "react";

function Login() {
    const handleLogin = () => {
        window.location.href = "http://localhost:4000/auth/discord"
    };

    return (
        <div style={{ display: "flex", height: "100vh", justifyContent: "center", alignItems: "center" }}>
           <button
             onClick={handleLogin}
             style={{
                padding: "15px 25px",
                fontSize: "18px",
                cursor: "pointer",
                background: "#5865F2",
                border: "none",
                borderRadius: "8px",
                color: "#fff"
             }}>
              🔑 Zaloguj przez Discord  
                </button> 
        </div>
    );
       
}

export default Login;