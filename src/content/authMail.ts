/* 認証メール（合言葉の決め直し・登録の確認）の差出人。

   自前の SMTP を入れるまで、Supabase の共用の送信元から出る。
   受け取る側にはこう見える。

     Supabase Auth <noreply@mail.app.supabase.io>
     Reset your password

   知らない英語の差出人から、英語で「パスワードを再設定しろ」とリンクが来る。
   迷惑メールの見分け方として教わるものと、そっくり同じ形をしている。
   押してもらえなければ、忘れた人はそこで詰まる。

   文面は Supabase の画面から日本語に直せる（docs/21）。
   **差出人だけは、自前の SMTP を入れないと変えられない。**
   だから、送ったあとの画面で「こういう差出人から届きます」と先に伝えておく。

   ── SMTP を入れたら ──
   ここを自社の差出人に直すか、空文字にすること。
   空にすれば、画面の案内も /setup の行も出なくなる。
   直し忘れると、画面に嘘の差出人が出たままになる。 */

export const AUTH_MAIL_FROM = "Supabase Auth <noreply@mail.app.supabase.io>";

/** 差出人の案内を出すか。自前の差出人にしたら出さない */
export const showMailFrom = (): boolean => AUTH_MAIL_FROM.trim().length > 0;
