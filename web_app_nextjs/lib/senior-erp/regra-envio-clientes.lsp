@ ==================================================================== @
@ ELO - Envio do cadastro de clientes (E085CLI) para o Painel Comercial @
@ Envia em lotes de 200 para https://owner-webappnextjs.vercel.app      @
@ Guia: lib/senior-erp/ENVIO_CLIENTES.md                               @
@ ==================================================================== @

Definir Alfa vToken;
Definir Alfa vUrl;
Definir Alfa vCursor;
Definir Alfa vHTTP;
Definir Alfa vResposta;
Definir Alfa vCorpo;
Definir Alfa vReg;
Definir Alfa vCampo;
Definir Alfa vLimpo;
Definir Alfa vNum;
Definir Alfa vResumo;
Definir Numero vCodigo;
Definir Numero vNoLote;
Definir Numero vTotal;
Definir Numero vLotes;
Definir Numero vErro;

@ >>> COLE AQUI O TOKEN GERADO NO SUPABASE (entre as aspas) <<< @
vToken = "COLE_O_TOKEN_AQUI";
vUrl = "https://owner-webappnextjs.vercel.app/api/senior/clientes";

vCorpo = "ELO1";
vNoLote = 0;
vTotal = 0;
vLotes = 0;
vErro = 0;
vResumo = "";

HttpObjeto(vHTTP);
HttpDesabilitaErroResposta(vHTTP);
HttpSetaTimeout(vHTTP, 60);
HttpAlteraCabecalhoRequisicao(vHTTP, "Content-Type", "text/plain");
HttpAlteraCabecalhoRequisicao(vHTTP, "x-elo-token", vToken);

SQL_Criar(vCursor);
SQL_UsarSQLSenior2(vCursor, 0);
SQL_UsarAbrangencia(vCursor, 0);
SQL_DefinirComando(vCursor, "SELECT CAST(CODCLI AS VARCHAR(20)) AS CODCLI, NOMCLI, APECLI, TIPCLI, CAST(CGCCPF AS VARCHAR(20)) AS CGCCPF, CIDCLI, SIGUFS, FONCLI, INTNET, SITCLI FROM E085CLI ORDER BY CODCLI");
SQL_AbrirCursor(vCursor);

Enquanto ((SQL_EOF(vCursor) = 0) e (vErro = 0))
{
  vReg = "";

  SQL_RetornarAlfa(vCursor, "CODCLI", vCampo);
  vReg = vCampo;

  SQL_RetornarAlfa(vCursor, "NOMCLI", vCampo);
  TrocaString(vCampo, "|", " ", vLimpo);
  TrocaString(vLimpo, "~", " ", vCampo);
  vReg = vReg + "|" + vCampo;

  SQL_RetornarAlfa(vCursor, "APECLI", vCampo);
  TrocaString(vCampo, "|", " ", vLimpo);
  TrocaString(vLimpo, "~", " ", vCampo);
  vReg = vReg + "|" + vCampo;

  SQL_RetornarAlfa(vCursor, "TIPCLI", vCampo);
  vReg = vReg + "|" + vCampo;

  SQL_RetornarAlfa(vCursor, "CGCCPF", vCampo);
  vReg = vReg + "|" + vCampo;

  SQL_RetornarAlfa(vCursor, "CIDCLI", vCampo);
  TrocaString(vCampo, "|", " ", vLimpo);
  TrocaString(vLimpo, "~", " ", vCampo);
  vReg = vReg + "|" + vCampo;

  SQL_RetornarAlfa(vCursor, "SIGUFS", vCampo);
  vReg = vReg + "|" + vCampo;

  SQL_RetornarAlfa(vCursor, "FONCLI", vCampo);
  TrocaString(vCampo, "|", " ", vLimpo);
  TrocaString(vLimpo, "~", " ", vCampo);
  vReg = vReg + "|" + vCampo;

  SQL_RetornarAlfa(vCursor, "INTNET", vCampo);
  TrocaString(vCampo, "|", " ", vLimpo);
  TrocaString(vLimpo, "~", " ", vCampo);
  vReg = vReg + "|" + vCampo;

  SQL_RetornarAlfa(vCursor, "SITCLI", vCampo);
  vReg = vReg + "|" + vCampo;

  vCorpo = vCorpo + "~" + vReg;
  vNoLote = vNoLote + 1;
  vTotal = vTotal + 1;

  @ Lote cheio: envia @
  Se (vNoLote >= 200)
  {
    HttpPost(vHTTP, vUrl, vCorpo, vResposta);
    HttpLeCodigoResposta(vHTTP, vCodigo);
    Se (vCodigo <> 200)
    {
      vErro = 1;
      IntParaAlfa(vCodigo, vNum);
      vResumo = "Erro HTTP " + vNum + ": " + vResposta;
    }
    vLotes = vLotes + 1;
    vCorpo = "ELO1";
    vNoLote = 0;
  }

  SQL_Proximo(vCursor);
}

SQL_FecharCursor(vCursor);
SQL_Destruir(vCursor);

@ Último lote (incompleto) @
Se ((vErro = 0) e (vNoLote > 0))
{
  HttpPost(vHTTP, vUrl, vCorpo, vResposta);
  HttpLeCodigoResposta(vHTTP, vCodigo);
  Se (vCodigo <> 200)
  {
    vErro = 1;
    IntParaAlfa(vCodigo, vNum);
    vResumo = "Erro HTTP " + vNum + ": " + vResposta;
  }
  vLotes = vLotes + 1;
}

Se (vErro = 0)
{
  IntParaAlfa(vTotal, vNum);
  vResumo = "Clientes enviados: " + vNum;
  IntParaAlfa(vLotes, vNum);
  vResumo = vResumo + " em " + vNum + " lote(s). Ultima resposta: " + vResposta;
}

Mensagem(Retorna, vResumo);
