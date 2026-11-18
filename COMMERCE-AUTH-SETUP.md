# Starting Toolkit: cadastro, ativação, Hotmart e e-mail automático

Este pacote prepara o fluxo de ativação de conta após compra aprovada, recuperação de senha, revogação por reembolso/chargeback e registro de abandono de carrinho. O pacote ainda precisa ser publicado e testado no Cloudflare antes de cadastrar/ativar o webhook na Hotmart.

## Estado do banco D1

O banco `startingtoolkit-db` já existe e a migração `0002_commerce_auth.sql` foi executada nesta implantação. **Não execute novamente a migração nem apague tabelas.** Ela está incluída no pacote apenas para histórico/reprodução em outro ambiente.

## Configuração do projeto Cloudflare Pages `app`

Binding D1:
- `DB` apontando para `startingtoolkit-db`.

Secrets:
- `RESEND_API_KEY`: chave de API criada no Resend.
- `HOTMART_HOTTOK`: token secreto gerado na configuração do webhook Hotmart.

Variables (Text):
- `MAIL_FROM`: `Starting Toolkit <support@startingtoolkit.com>` (domínio já verificado no Resend).
- `APP_BASE_URL`: `https://app.startingtoolkit.com`.
- `HOTMART_PRODUCT_ID`: ID numérico do produto Starting Toolkit na Hotmart. Obrigatório para aceitar eventos.
- `HOTMART_OFFER_PT`: código da oferta brasileira, se disponível.
- `HOTMART_OFFER_EN`: código da oferta internacional em inglês, se houver.
- `HOTMART_OFFER_ES`: código da oferta internacional em espanhol, se houver.

Não coloque tokens/chaves no código, GitHub ou variáveis públicas. Não altere MX/SPF do ImprovMX. `MAIL_FROM` deve ser exatamente o endereço verificado no Resend.

## Rotas incluídas

- `POST /api/webhooks/hotmart`: recebe e valida eventos usando o `hottok` enviado no corpo JSON pela Hotmart 2.0 (e aceita também o cabeçalho `X-HOTMART-HOTTOK` para compatibilidade). Os postbacks de teste com nome de produto contendo `test postback` são reconhecidos e apenas confirmados, sem criar contas ou enviar e-mails.
- `GET /api/auth/activation-info?token=...`: valida link de ativação.
- `POST /api/auth/activate`: cria/atualiza a conta e cria licença de 365 dias com limite de um negócio, contando a partir do registro da compra aprovada pelo webhook da Hotmart (campo `purchase_access_tokens.created_at`), e não da criação da senha/primeiro login.
- `POST /api/auth/password-reset-request`: envia link de redefinição.
- `POST /api/auth/password-reset`: redefine a senha e encerra sessões existentes.
- `POST /api/auth/resend-activation`: reenvia link de ativação de compra aprovada pendente.

## Eventos Hotmart tratados

- `PURCHASE_APPROVED` / `PURCHASE_COMPLETE`: cria token de ativação e envia e-mail no idioma identificado.
- `PURCHASE_REFUNDED`, `PURCHASE_CHARGEBACK`, `PURCHASE_CANCELED`, `PURCHASE_EXPIRED` e `PURCHASE_PROTEST`: revoga a licença associada à transação e encerra as sessões do usuário.
- `PURCHASE_OUT_OF_SHOPPING_CART`: registra o abandono em `hotmart_webhook_events`, sem criar conta, liberar licença ou enviar e-mail de marketing.

Eventos duplicados com o mesmo ID são ignorados depois de processados. Se o payload não trouxer ID, o código usa hash do corpo como identificador de repetição. O evento de abandono depende de a Hotmart enviar o ID do produto no payload. Se o payload de teste da Hotmart tiver estrutura diferente, ajuste o mapeamento antes de ativar em produção.

## Configuração do webhook

URL:
`https://app.startingtoolkit.com/api/webhooks/hotmart`

Selecione a versão 2.0.0 e os eventos de aprovação, reembolso, chargeback, cancelamento/expiração e abandono de carrinho. Configure o mesmo Hottok no campo secreto do Cloudflare `HOTMART_HOTTOK`.

O código exige o ID do produto e compara com `HOTMART_PRODUCT_ID`. Os códigos de oferta podem ser usados para distinguir o idioma; sem eles, o código tenta usar locale, moeda e país do payload, adotando inglês como padrão internacional.

## Ordem de publicação e testes

1. Faça backup do projeto atual e publique os arquivos deste pacote no projeto `app`, preservando o binding D1.
2. Confirme que `RESEND_API_KEY` e `MAIL_FROM` já estão presentes e adicione `APP_BASE_URL`.
3. Obtenha o ID numérico do produto e os códigos das ofertas na Hotmart. Configure `HOTMART_PRODUCT_ID` e, quando possível, os códigos de idioma.
4. Configure `HOTMART_HOTTOK` como Secret depois de gerar o webhook na Hotmart.
5. Faça deploy do projeto após adicionar variáveis/secrets.
6. Teste o endpoint sem Hottok válido: deve responder 401. Não use token verdadeiro em prints ou mensagens.
7. Use o teste oficial de webhook da Hotmart e confira `hotmart_webhook_events`.
8. Faça uma compra de teste aprovada: confirme e-mail, ativação, login e criação de um negócio.
9. Teste reembolso/chargeback em compra de teste antes de vender publicamente.
10. Confirme um evento de abandono: deve ser registrado sem liberar licença nem enviar e-mail.

## Limitações e cuidados

- O fluxo de compra e entrega precisa ser testado com payloads reais/simulados da Hotmart antes da abertura das vendas.
- A licença criada na ativação dura 365 dias a partir do recebimento/registro do evento de compra aprovada pela Hotmart no banco (não do primeiro login) e permite um negócio. O timestamp é preservado mesmo se o link de ativação for reenviado.
- A página antiga de cadastro administrativo continua exigindo convite; compradores usam o link individual enviado após pagamento aprovado.
- O tratamento de abandono é apenas registro analítico. Não faz recuperação automática nem autoriza marketing. Uma campanha de recuperação deve ser configurada separadamente, respeitando consentimento e regras aplicáveis.
- A integração não foi publicada no Cloudflare nem validada com uma compra real por este pacote. Não considerar vendas liberadas até concluir os testes.
