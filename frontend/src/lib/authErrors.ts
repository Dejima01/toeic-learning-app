export function getAuthErrorMessage(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'このメールアドレスはすでに使用されています';
    case 'auth/weak-password':
      return 'パスワードは6文字以上で入力してください';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'メールアドレスまたはパスワードが正しくありません';
    case 'auth/invalid-email':
      return '有効なメールアドレスを入力してください';
    case 'auth/too-many-requests':
      return 'しばらく経ってから再度お試しください';
    case 'auth/expired-action-code':
      return 'リンクの有効期限が切れています。再度お試しください';
    case 'auth/invalid-action-code':
      return '無効なリンクです。再度お試しください';
    default:
      return 'エラーが発生しました。しばらく経ってから再度お試しください';
  }
}
