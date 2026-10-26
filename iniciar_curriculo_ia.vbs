' Sobe o Currículo IA escondido (sem janela), em produção, registrando em curriculo-ia.log.
' Para ligar junto com o PC, copie este arquivo para a pasta Inicializar do Windows (Win+R, shell:startup).
' Com AUTO_CANDIDATAR=1 no .env.local, a candidatura automática começa a rodar junto.
Set sh = CreateObject("WScript.Shell")
pasta = "C:\Users\Guilherme\Downloads\curriculo-ia"
sh.CurrentDirectory = pasta
sh.Run "cmd /c npm run build >> curriculo-ia.log 2>&1 && npm run start -- -p 3000 >> curriculo-ia.log 2>&1", 0, False
