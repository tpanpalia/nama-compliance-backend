import dotenv from 'dotenv';
import app from './app';

dotenv.config();

const port = parseInt(process.env.PORT || '3000', 10);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on port ${port}`);
});
