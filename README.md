# 三者懇談サポート

ブラウザで動作する NOBATASU Tools 由来の独立配布版です。Webアプリ本体にはDB・PHP処理は不要です。フォーム作成・回答保存には利用者のGoogleアカウントを使用します。

## 起動

Docker を使う場合は `docker compose up --build` を実行し、http://127.0.0.1:8091/ を開きます。ポートが使用中ならComposeの左側のポートを変更してください。

DockerなしではPython 3.10以上を用意して実行します。

```sh
python3 scripts/build.py
python3 -m unittest scripts/test_build.py
python3 -m http.server 8091 --bind 127.0.0.1 --directory build/site
```

HTML/CSS/JavaScriptを直接編集できます。 必要なライブラリはローカル同梱しています。初回のDockerイメージ取得にはインターネット接続が必要ですが、通常のアプリ画面は外部CDNを取得しません。

## データの扱い

このアプリ画面から自動的にデータを外部送信する処理はありません。希望調査フォームの利用には、生成したGoogle Apps Scriptを利用者自身のGoogleアカウントで実行し、フォーム・回答スプレッドシートを作成します。保護者がフォームで回答すると、そのデータはGoogle側へ送信・保存されます。学校の運用規定とGoogle管理者の制限に従って利用してください。アプリの設定・入力は、画面の保存機能やブラウザの localStorage に残る場合があります。共有端末では利用後に画面の消去機能を使い、残る情報はブラウザのサイトデータから削除してください。ダウンロードしたファイルは各自で管理してください。

学校設定はタブのsessionStorageに保持されます。生成したGASコード・設定JSON・回答Excel・配布物に個人情報が含まれ得るため、共有先を確認してください。フォルダや画像・回答データをGitHubへアップロードしないでください。

独立版では販促ページ・スクリーンショット・デモ回答Excel・アニメーションを含みません。フォーム生成・案内印刷・回答読込・日程作成を提供します。Google側での実アカウント実行は今回のローカルQA対象外です。

## ソースとライセンス

アプリのコード・デザインは **AGPL-3.0-or-later**。第三者ライブラリ・フォントには原ライセンスが適用されます（`THIRD-PARTY-NOTICES.md`）。名称・ブランドは `TRADEMARKS.md` を参照してください。

画面の「この版のソース」は、そのビルドに対応した `source/conference-form-generator-source.zip` を取得します。ZIPには編集用ソース、ビルド設定、ライセンス、検証コードが含まれます。改変して配信するときも `python3 scripts/build.py` で対応するZIPを生成し、`build/site/` 全体を配置してください。

この独立版は公式サイトの外枠・広告・ブランド画像を含みません。公式サイトで稼働中の版そのものの対応ソースを示すものではありません。

公開リポジトリ: https://github.com/kurumi0715555/nobatasu-conference-form-generator

開発の正本で検証した変更を、このPublicリポジトリのmainへ反映します。提案はmain向けPull Requestで受け付けます。公開側CIには公式サイトへの配信権限はありません。

## 配布ファイル

- HTML/CSS/JS、必要な画像生成・Excel等のライブラリ: アプリ実行用。
- src・package設定（TS版）、scripts、テスト: 改良・再ビルド・検証用。
- DockerとCI: ローカル起動・変更検証用。
- README・LICENSE・通知: 利用方法・再配布条件。

`build/site/` はアプリ実行ファイルと対応ソースZIPだけを含みます。READMEやテストは通常のWeb画面として配置しません。
