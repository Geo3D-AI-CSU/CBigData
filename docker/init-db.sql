-- CBigData PostgreSQL 初始化脚本
-- 在容器首次启动时自动执行

-- 用户表 (认证服务)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    phone_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 插入测试用户 (密码: 123456)
-- 安全要求：不再创建带默认明文密码的管理员账号。
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
ON users (LOWER(email)) WHERE email IS NOT NULL AND email <> '';

-- OCO-2 碳卫星观测数据
CREATE TABLE IF NOT EXISTS oco_data (
    id SERIAL PRIMARY KEY,
    longitude DOUBLE PRECISION NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    xco2 DOUBLE PRECISION,           -- 干空气柱平均 CO₂ 摩尔分数 (ppm)
    xco2_uncertainty DOUBLE PRECISION,
    time TIMESTAMP NOT NULL,
    sounding_id BIGINT,
    operation_mode SMALLINT,
    land_water_indicator SMALLINT,
    gain VARCHAR(10),
    solar_zenith_angle DOUBLE PRECISION,
    quality_flag SMALLINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 索引加速空间/时间查询
CREATE INDEX IF NOT EXISTS idx_oco_data_time ON oco_data (time);
CREATE INDEX IF NOT EXISTS idx_oco_data_lonlat ON oco_data (longitude, latitude);
CREATE INDEX IF NOT EXISTS idx_oco_data_quality ON oco_data (quality_flag);

-- GEDI 激光雷达数据
CREATE TABLE IF NOT EXISTS gedi_data (
    id SERIAL PRIMARY KEY,
    longitude DOUBLE PRECISION NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    rh98 DOUBLE PRECISION,           -- 98% 相对高度 (冠层高度, m)
    rh75 DOUBLE PRECISION,           -- 75% 相对高度
    rh50 DOUBLE PRECISION,           -- 50% 相对高度
    agbd DOUBLE PRECISION,           -- 地上生物量密度 (Mg/ha)
    agbd_uncertainty DOUBLE PRECISION,
    time TIMESTAMP NOT NULL,
    shot_number BIGINT,
    quality_flag SMALLINT DEFAULT 0,
    degrade_flag SMALLINT DEFAULT 0,
    beam SMALLINT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gedi_data_time ON gedi_data (time);
CREATE INDEX IF NOT EXISTS idx_gedi_data_lonlat ON gedi_data (longitude, latitude);
