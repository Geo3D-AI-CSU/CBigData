-- CBigData 碳中和时空大数据平台 数据库建表脚本
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(200),
  phone_number VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
ON users (LOWER(email)) WHERE email IS NOT NULL AND email <> '';

-- OCO-2 碳卫星数据主表
CREATE TABLE IF NOT EXISTS oco_data (
  id SERIAL PRIMARY KEY,
  longitude DOUBLE PRECISION,
  latitude DOUBLE PRECISION,
  xco2 DOUBLE PRECISION,
  time TIMESTAMP
);

-- 按日分表 (2024年3月16-31日)
DO $$
DECLARE
  i INT;
  table_name TEXT;
BEGIN
  FOR i IN 16..31 LOOP
    table_name := 'oco2_2403' || i::TEXT;
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS %I (
        id SERIAL PRIMARY KEY,
        longitude DOUBLE PRECISION,
        latitude DOUBLE PRECISION,
        xco2 DOUBLE PRECISION,
        time TIMESTAMP
      )', table_name);
  END LOOP;
END $$;

-- 验证建表结果
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
