import app from './app';
import { env } from './utils/env';

const PORT = env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${env.NODE_ENV} mode`);
});
