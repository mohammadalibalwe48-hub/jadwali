class ScannerEndpoint {
  const ScannerEndpoint(this.url, this.publicKey);
  final Uri url;
  final String? publicKey;

  static ScannerEndpoint? resolve(
    String customOrigin, {
    String supabaseUrl = const String.fromEnvironment(
      'JADWALI_SUPABASE_URL',
      defaultValue: 'https://reuhnwabqvbrejhmjnty.supabase.co',
    ),
    String publicKey = const String.fromEnvironment(
      'JADWALI_SUPABASE_ANON_KEY',
    ),
  }) {
    if (customOrigin.isNotEmpty) {
      return ScannerEndpoint(
        Uri.parse(customOrigin).resolve('/api/vision'),
        null,
      );
    }
    if (publicKey.isEmpty) return null;
    return ScannerEndpoint(
      Uri.parse(supabaseUrl).resolve('/functions/v1/jadwali-vision'),
      publicKey,
    );
  }
}
