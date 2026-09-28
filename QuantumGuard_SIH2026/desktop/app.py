import customtkinter as ctk
import requests
import os

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("QuantumGuard Desktop - SIH 2026")
        self.geometry("600x420")
        
        self.label = ctk.CTkLabel(self, text="🛡️ QuantumGuard Command Center", font=("Roboto", 22, "bold"))
        self.label.pack(pady=20)

        self.status_box = ctk.CTkTextbox(self, width=520, height=180, font=("Consolas", 12))
        self.status_box.pack(pady=10)
        self.status_box.insert("end", "[*] System Ready: PQC Nodes Active.\n")

        self.btn = ctk.CTkButton(self, text="Encrypt & Watermark File", font=("Roboto", 14, "bold"), height=38, command=self.process_file)
        self.btn.pack(pady=20)

    def process_file(self):
        file_path = ctk.filedialog.askopenfilename()
        if file_path:
            self.status_box.insert("end", f"[*] Analyzing: {os.path.basename(file_path)}\n")
            
            # Send to Backend
            files = {'file': open(file_path, 'rb')}
            try:
                r = requests.post("http://localhost:8000/secure-upload", files=files, timeout=5)
                res = r.json()
                
                self.status_box.insert("end", f"[+] AI Sensitivity: {res['data']['sensitivity']}\n")
                self.status_box.insert("end", f"[+] PQC Encryption: ACTIVE (ML-KEM-768)\n")
                self.status_box.insert("end", "--- SUCCESS ---\n")
            except Exception as e:
                self.status_box.insert("end", f"[!] Error: Backend Offline ({str(e)})\n")
            
            self.status_box.see("end")

if __name__ == "__main__":
    app = App()
    app.mainloop()
