# Ajuste de validade da licença

A licença de comprador agora usa `purchase_access_tokens.created_at` como início da validade. Esse campo é preenchido pelo D1 no momento em que o webhook de compra aprovada da Hotmart cria o token de ativação.

- A validade é de 365 dias a partir da confirmação/registro da compra aprovada.
- O tempo gasto pelo comprador para abrir o e-mail e criar a senha não reduz o período de acesso.
- Reenvios do link de ativação preservam `created_at`, portanto não reiniciam os 365 dias.
- O link de ativação continua tendo validade própria de 48 horas, independente da licença.

Não é necessária nova migração SQL para esta alteração. O campo `created_at` já existe na tabela `purchase_access_tokens` criada pela migração `0002_commerce_auth.sql`. Não execute novamente essa migração.

Observação: a data usada é o momento em que o webhook de aprovação é registrado no banco. Na prática, é a confirmação de compra recebida pela integração.
