export default async function handler(req, res) {
  res.setHeader('Allow', 'POST');
  return res.status(410).json({
    success: false,
    error: 'This upload endpoint is disabled. Use Firebase Storage for product photos.'
  });
}
