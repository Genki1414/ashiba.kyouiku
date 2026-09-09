# マイグレーションの検証

Supabase を立てずに、素の PostgreSQL 16 で構文と業務ルールだけ確かめる手順。
`00-supabase-shim.sql` が `auth.users` / `auth.uid()` / `auth.role()` を代用する。

```sh
D=/var/tmp/pgtest
mkdir -p $D && chown postgres:postgres $D && chmod 700 $D
su postgres -c "/usr/lib/postgresql/16/bin/initdb -D $D/data -U postgres"
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $D/data -o '-k $D -c listen_addresses=' -l $D/log start"

su postgres -c "psql -h $D -U postgres -v ON_ERROR_STOP=1 \
  -f supabase/tests/00-supabase-shim.sql \
  -f supabase/migrations/0001_init.sql \
  -f supabase/migrations/0002_rls.sql \
  -f supabase/migrations/0003_rules.sql \
  -f supabase/tests/rules.sql"
```

`rules.sql` が確かめること（いずれも NOTICE で expected: … と出れば通過）

| # | 内容 |
|---|---|
| 1 | 1,000秒と申告しても、実経過を超えては加算されない |
| 2 | 規定時間に達するまで確認問題を合格にできない |
| 3 | 規定時間に達すれば合格できる |
| 4 | 未入金の注文では修了証を発行できない |
| 5 | 入金後は発行できる |
| 6 | 他人の受講の視聴時間は加算できない |
| 7 | 受講者が自分の所属・権限を書き換えられない |
| 8 | `status='paid'` と `paid_at` の不整合が入らない |

---

## 教育担当者の画面が使う問い合わせの検証

`tests/admin-db.mts` は、アプリが実際に投げる問い合わせ（表名・列名・絞り込み）を
本物のスキーマに当てて確かめる。PostgREST 互換 shim を挟むので、
`@supabase/supabase-js` の書き方そのままで試験できる。

```sh
D=/var/tmp/pgtest
mkdir -p $D && chown postgres:postgres $D && chmod 700 $D
su postgres -c "/usr/lib/postgresql/16/bin/initdb -D $D/data -U postgres"
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $D/data \
  -o \"-k $D -c listen_addresses=127.0.0.1 -p 55432\" -l $D/log start"
su postgres -c "psql -h 127.0.0.1 -p 55432 -U postgres -c 'create database appdb'"
su postgres -c "psql -h 127.0.0.1 -p 55432 -U postgres -d appdb -v ON_ERROR_STOP=1 \
  -f supabase/tests/00-supabase-shim.sql -f supabase/apply-all.sql"

node tests/postgrest-shim.mjs 54321 postgres://postgres@127.0.0.1:55432/appdb &
npm run test:admindb
```

確かめること

| # | 内容 |
|---|---|
| 1 | apply-all.sql（0001〜0007）が素の PostgreSQL で通る |
| 2 | ログインの行を作ると、トリガが受講者の行を作る（氏名も入る） |
| 3 | 事業者が1社だけなら自動で所属する。2社以上なら空のまま |
| 4 | 実務トレーニングの成績が書ける。知らない章・100点超は入らない |
| 5 | 担当者の一覧の問い合わせが、表と列に噛み合っている |
| 6 | 修了証は1受講に1枚。取り消せば出し直せる。記録は残る |
| 7 | 担当者の任命・解任が通る |

RLS そのものはここでは見ていない（shim は service_role として動く）。
RLS は `supabase/tests/rules.sql` が受け持つ。

## お知らせ（0024）

`notices.sql` は、全部の版を流したあとに当てる（`apply-all.sql` を使う）。

```sh
psql -d appdb -q -t -A \
  -f supabase/tests/00-supabase-shim.sql \
  -f supabase/apply-all.sql
psql -d appdb -q -t -A -f supabase/tests/notices.sql
```

最後に「24 件通過 / 0 件失敗」と出れば通っている。

| # | 内容 |
|---|---|
| ① | 知らせを1件足せる |
| ② | 同じ返事を続けて2回押しても1行（60秒のあいだ） |
| ③④⑤ | 種類・講座・宛先が違えば、別の行になる |
| ⑥ | 押し直すと、あとの一言で上書きされ、未読に戻る |
| ⑦ | 時間が空いた同じ返事は、別の出来事として並ぶ |
| ⑧ | 宛先や種類が空でも落ちない（作らないだけ） |
| ⑨ | 読んだ印は、その人のぶんだけ付く |
| ⑩ | 古い知らせを捨てられる |
| ⑪ | 人を消したら、その人あての知らせも消える |
| ⑫ | **ログインした人からは、自分あての知らせを作れない** |

## 席を直接配る（0028）

`assign-seat.sql` も、全部の版を流したあとに当てる。

受けさせる人が決まっているとき、受講コードの12文字を口頭やLINEで伝えて
打ち込ませるのは、要らない手間で、間違いのもとになる。
担当者が人と講座を選べば、その場で渡る。

**受講コードの方式は残してある。**その場に居ない人、まだ名簿に入っていない人には
コードを渡すしかない。画面が動かないときの逃げ道にもなる。⑫で一緒に見ている。

```sh
psql -d appdb -q -t -A \
  -f supabase/tests/00-supabase-shim.sql \
  -f supabase/apply-all.sql

psql -d appdb -q -t -A -f supabase/tests/assign-seat.sql
```

「22 件通過 / 0 件失敗」と出れば通っている。

| # | 内容 |
|---|---|
| ① | 在籍している人に配れる。席が使われ、受講ができ、受けた当時の会社が残る |
| ② | 配ったら、その人のその講座のリクエストが閉じる |
| ③ | **同じ講座の席を二重に渡さない** |
| ④ | **よその会社の人には渡せない** |
| ⑤ | **辞めた人には渡せない**（渡ると席が戻らないまま消える） |
| ⑥ | よその会社が買った席は配れない |
| ⑦ | 無い講座は配れない |
| ⑧ | 残っている席から順に、次の人に配れる |
| ⑨ | **空きが無ければはじく**（黙って渡ったことにしない） |
| ⑩ | **期限切れの席は配らない**（渡した先で開かない） |
| ⑪ | ログインした人から直に呼べない |
| ⑫ | **受講コードの方式が残っている**（redeem_seat で入れる） |
| ⑬ | 戻した席は、また配れる |

## 受講リクエスト（0025）

`course-request.sql` も、全部の版を流したあとに当てる。

**コードを渡されていない人が、担当者に「この講座を受けたい」と言う道。**
電話や口頭でしか言えなかったものを、画面に残す仕組み。
席（受講コード）はここでは作らない。担当者がいつもどおり用意する。

```sh
psql -d appdb -q -t -A \
  -f supabase/tests/00-supabase-shim.sql \
  -f supabase/apply-all.sql

psql -d appdb -q -t -A -f supabase/tests/course-request.sql
```

「23 件通過 / 0 件失敗」と出れば通っている。

| # | 内容 |
|---|---|
| ① | 在籍している人は送れる。**宛先は在籍している会社**（画面から受け取らない） |
| ② | 連打しても増えない。同じ講座に開いているものは1件だけ |
| ③ | 別の講座は別に立つ |
| ④ | 無い講座ははじく |
| ⑤ | **会社に居ない人は送れない**（誰宛か決まらない） |
| ⑥ | 押し間違いを取り消せる |
| ⑦ | 担当者が対応済みにできる。誰が対応したかが残る |
| ⑧ | **よその会社のリクエストは動かせない** |
| ⑨ | **対応済みのあとは、本人が取り消せない**（もう届いているので無かったことにはできない） |
| ⑩ | 対応済みを戻せば、また送れる（押し間違い用） |
| ⑪ | ログインした人から直に呼べない。RLS が入っている |
| ⑫ | 人を消したら、リクエストも一緒に消える（3年で消すときに残らない） |
| ⑬ | 会社への参照が張ってある |

## 実技の関門（0023 の drill）

`drill.sql` も、全部の版を流したあとに当てる。

学科だけで修了証を出せば、実技を受けていない人が
「資格がある」と思って現場に出る。

**実技のある講座は増える。講座は `-v course=...` で渡す**（既定は高所作業車）。
単元の数と時間は渡さず、`courses` 表と突き合わせる。
渡すと、渡した数字が間違っていたときに気づけない。

```sh
psql -d appdb -q -t -A \
  -f supabase/tests/00-supabase-shim.sql \
  -f supabase/apply-all.sql

psql -d appdb -q -t -A -f supabase/tests/drill.sql                   # 高所作業車
psql -d appdb -q -t -A -v course=harness -f supabase/tests/drill.sql # フルハーネス
psql -d appdb -q -t -A -v course=rope -f supabase/tests/drill.sql    # ロープ高所作業
```

それぞれ「28 件通過 / 0 件失敗」と出れば通っている。
**実技のある講座を足したら、その講座でも回すこと。**

| # | 内容 |
|---|---|
| ① | 講座と単元が入っていて、**単元の合計＝講座の総時間**（courses 表と突き合わせ） |
| ② | 実技の実施日と実施者が、申請と一緒に残る |
| ③ | **出しただけでは通っていない**（＝修了証は出ない） |
| ④ | 断れる。理由が本人に届く |
| ⑤ | 出し直せる。日と人が入れ替わり、前の理由は消える |
| ⑥ | 実技の講座に、討議の候補日は出ない |
| ⑦ | 本部が通してはじめて修了。通しても実技の記録は残る |
| ⑧ | 通ったあとに出し直せない（修了の取り消しになる） |
| ⑨ | 知らない関門（talk / drill 以外）ははじく |
| ⑩ | **ログインした人から、自分の申請を直に通せない** |
| ⑪ | 受講を消したら申請も消える（3年で消すときに残らない） |

画面側は `npm run test:issue` と `node tests/e2e-issue.mjs` が見ている。

## まとめ申込み（0029・0030）

`order-group.sql` も、全部の版を流したあとに当てる。

**申込みは1回、請求書は1枚、振込も1回。**注文の行は講座ごとに立てる
（受講コードは講座ごとに出るため）が、同じ申込みの行は同じ group_id を持つ。
「請求書を出した」印（0030）も申込みまるごと。

```sh
psql -d appdb -q -t -A -f supabase/tests/order-group.sql
```

「OK: まとめ申込み（0029・0030）」と出れば通っている。

| # | 内容 |
|---|---|
| ① | 3講座を、ひとまとめの印を付けて入れられる |
| ② | 申込みは行の数ではなく group で数えて1件 |
| ③ | 合計は行を足したもの（請求書はこの1枚） |
| ④ | **印を書き忘れても、勝手に埋まる**（その注文だけ請求書が出ない、を起こさない） |
| ⑤ | 入金は申込みまるごと立つ（押し忘れた講座だけ受講コードが出ない、を起こさない） |
| ⑥ | 別の申込みは巻き込まない |
| ⑦ | 入金済みの行に入金日時が入っている |
| ⑧ | 古い注文にも印が入っている（古い請求書が開けなくなっていない） |
| ⑨ | **「請求書を出した」も申込みまるごと。**知らせの金額が請求書と合い、送り直しで日付が動かない |

## 受講コードを指して配る（0031）

`assign-by-code.sql` も、全部の版を流したあとに当てる。

受講コードの一覧の「配る」からは、**押したそのコード**が渡らないとおかしい
（げんきさん 2026-09-09）。同じ日の「取得済の資格には受講コード配布不可」も
ここで見る。

```sh
psql -d appdb -q -t -A -f supabase/tests/assign-by-code.sql
```

「OK: 受講コードを指して配る（0031）」と出れば通っている。
**1つの DB に2回当てないこと**（2回目は席がもう渡っているので、別の理由で止まる）。

| # | 内容 |
|---|---|
| ④ | **よその会社のコードを指しても渡らない。**断る文で在り処を教えない |
| ③ | 別の講座のコードを指しても渡らない |
| ① | 指したコードが、そのまま渡る（自動なら別の1枚が選ばれる所で） |
| ② | 指さなければ、今までどおり自動（名簿の「席を配る」が壊れない） |
| ⑤ | 期限切れのコードを指しても渡らない |
| ⑥ | 配ったら、その人のその講座の受講リクエストが片づく |
| ⑦ | **修了証が出ている（取得済み）人には渡らない。**席を戻したあとでも。取り消した修了証なら渡る |

画面側は `npx tsx tests/api-shape.mts` と `node tests/e2e-order-multi.mjs` が見ている。

## クーポンと広告費（0032）

`coupon.sql` も、全部の版を流したあとに当てる。

紹介や業界団体に配るクーポンと、紹介してくれた人への広告費。
値引きは**率と定額の両方**、広告費は**割引後の税抜売上 ×％**
（げんきさんが決めた。2026-09-09）。

```sh
psql -d appdb -q -t -A -f supabase/tests/coupon.sql
```

「OK: クーポンと広告費（0032）」と出れば通っている。
**1つの DB に2回当てないこと**（2回目は同じクーポンを作ろうとして止まる）。

| # | 内容 |
|---|---|
| ① | 率で引ける |
| ② | 端数は切り捨て（1円でも多く引くと、こちらの取り分が減る） |
| ③ | **定額は、割引前を超えない**（総額がマイナスにならない） |
| ④ | 打ち方の揺れ（小文字・空白）をそろえる |
| ⑤ | 無いクーポンは、そう言う |
| ⑥ | **広告費は「割引後の税抜 ×％」** |
| ⑦ | 同じ申込みに2枚は使えない |
| ⑧ | **使った時の率が焼き付く**（あとで率を変えても、過去は動かない） |
| ⑨〜⑪ | 停止・期限切れ・まだ始まっていない、で断れる |
| ⑫ | 1事業者あたりの上限。よその会社は使える |
| ⑬ | **取り消した申込みは、使った回数に数えない** |
| ⑭ | 全体の上限で断れる |
| ⑮ | 使うのをやめられる（注文を作れなかったとき） |
| ⑯ | 支払い先の無いクーポンでは、広告費が出ない |

値引きの式は**画面（src/lib/coupon.ts）にも同じものがある。**
片方だけ直すと、見せた金額と請求する金額が食い違う。
画面側は `npx tsx tests/coupon.ts`、`npx tsx tests/api-shape.mts`、
`node tests/e2e-coupon.mjs` が見ている。

---

## 動いている本番に、もう一度流せるか（rerun.sql）

`apply-all.sql` は「何度実行しても壊れない」約束で書いてある。
**2つ以上の講座を受けている人が居る**データベースに流し直したときに
落ちないかを、ここで確かめる。

```sh
# 新しいデータベースに
psql -v ON_ERROR_STOP=1 \
  -f supabase/tests/00-supabase-shim.sql \
  -f supabase/apply-all.sql \
  -f supabase/tests/rerun.sql \
  -f supabase/apply-all.sql      # ← 2回目。ここが通れば通過
```

2026-09-09、げんきさんの本番で 0034 を流したときに、ここで止まった。

```
ERROR: could not create unique index "enrollments_one_per_user_idx"
DETAIL: Key (user_id)=(…) is duplicated.
```

0004 が作る索引を 0011 が外しているので、流し直すと 0004 で作り直そうとして
いまのデータに弾かれていた。0004 側に「0011 まで進んでいたら作らない」を
足して直した。

---

## LINE の紐付けが店ごとに分かれているか（line-link.sql）

```sh
psql -v ON_ERROR_STOP=1 \
  -f supabase/tests/00-supabase-shim.sql \
  -f supabase/apply-all.sql \
  -f supabase/tests/line-link.sql
```

NOTICE で `expected: …` が5つ出れば通過。

| # | 内容 |
| --- | --- |
| ① | 同じ人が、店ごとに違う番号を持てる |
| ② | 同じ店の中では、1つの番号は1人にだけ |
| ③ | 店が違えば、同じ字の番号でも別物として入る |
| ④ | 1人につき、1店1行 |
| ⑤ | 人を消したら、紐付けも消える |

---

## 無償利用の抜け道が塞がっているか（no-trial.sql）

```sh
psql -v ON_ERROR_STOP=1 \
  -f supabase/tests/00-supabase-shim.sql \
  -f supabase/apply-all.sql \
  -f supabase/tests/no-trial.sql
```

`companies.trial` を立てた会社の人でも、**席が無ければ修了証は出ない**こと。
画面側で無償利用を見なくしても、データベースに抜け道が残っていた（0035 で塞いだ）。
