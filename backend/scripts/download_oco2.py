#!/usr/bin/env python3
"""
OCO-2 / OCO-3 数据下载脚本 — 为 CBigData 项目获取 XCO₂ 数据并写入 PostgreSQL

数据源:   NASA GES DISC — OCO-2 Lite / OCO-3 Lite (bias-corrected)
覆盖范围: 全球 (默认无空间过滤; 可通过 --bbox 按需限定区域)
目标日期: 2024年3月16日 至 3月31日 (对应 oco2_240316 ~ oco2_240331 表)

前置条件:
  1. 注册 NASA Earthdata 账号: https://urs.earthdata.nasa.gov/
  2. 在本机创建 ~/.netrc 文件:
       machine urs.earthdata.nasa.gov login <your_username> password <your_password>
  3. 安装依赖:
       pip install earthaccess psycopg2-binary netCDF4 xarray pandas

用法:
  python download_oco2.py                          # 下载全部 16 天 OCO-2 全球数据
  python download_oco2.py --satellite oco3         # 下载 OCO-3 数据
  python download_oco2.py --dry-run                # 仅列出可用文件，不下载
  python download_oco2.py --days 16,17             # 只下载指定日期 (3月16-17日)
  python download_oco2.py --bbox 70 15 140 55      # 仅下载指定空间范围 (中国区域示例)
"""

import argparse
import os
import sys
import logging
from datetime import datetime, date
from pathlib import Path

# ── 配置 ──────────────────────────────────────────────
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "dbname": os.getenv("DB_NAME", "postgres"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "123456"),
}

# OCO-2 / OCO-3 数据集定义 (Lite 文件 — 偏差校正，体积小)
DATASETS = {
    "oco2": {
        "short_name": "OCO2_L2_Lite_FP",
        "version": "11.1r",
        "table_prefix": "oco2",
    },
    "oco3": {
        "short_name": "OCO3_L2_Lite_FP",
        "version": "11.1r",
        "table_prefix": "oco3",
    },
}

# 目标日期范围
START_DATE = date(2024, 3, 16)
END_DATE = date(2024, 3, 31)

# 下载缓存目录
CACHE_DIR = Path(__file__).parent / ".oco2_cache"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("oco2-download")


# ── 辅助函数 ──────────────────────────────────────────
def validate_environment():
    """检查 Python 依赖和 Earthdata 凭据"""
    missing = []
    for mod_name in ["earthaccess", "psycopg2", "netCDF4", "xarray"]:
        try:
            __import__(mod_name)
        except ImportError:
            missing.append(mod_name)
    if missing:
        log.error("缺少 Python 包: %s", ", ".join(missing))
        log.error("请运行: pip install earthaccess psycopg2-binary netCDF4 xarray pandas")
        sys.exit(1)

    netrc_path = Path.home() / ".netrc"
    if not netrc_path.exists():
        log.warning("未检测到 ~/.netrc 文件。earthaccess 将尝试其他认证方式。")
        log.warning("建议创建 ~/.netrc:")
        log.warning("  machine urs.earthdata.nasa.gov login <username> password <password>")


def table_name_for_date(d: date, prefix: str = "oco2") -> str:
    """根据日期和卫星前缀生成表名: oco2_240316 / oco3_240316"""
    return f"{prefix}_{d.strftime('%y%m%d')}"


def ensure_tables(conn, dates: list[date], prefix: str = "oco2"):
    """为每个日期创建表（如不存在）并清空已有数据"""
    with conn.cursor() as cur:
        for d in dates:
            tbl = table_name_for_date(d, prefix)
            cur.execute(f"""
                CREATE TABLE IF NOT EXISTS {tbl} (
                    id          SERIAL PRIMARY KEY,
                    longitude   DOUBLE PRECISION,
                    latitude    DOUBLE PRECISION,
                    xco2        DOUBLE PRECISION,
                    time        TIMESTAMP WITHOUT TIME ZONE
                )
            """)
            cur.execute(f"TRUNCATE TABLE {tbl}")
        # 同时写入汇总表
        summary_table = f"{prefix}_data"
        cur.execute(f"""
            CREATE TABLE IF NOT EXISTS {summary_table} (
                id          SERIAL PRIMARY KEY,
                longitude   DOUBLE PRECISION,
                latitude    DOUBLE PRECISION,
                xco2        DOUBLE PRECISION,
                time        TIMESTAMP WITHOUT TIME ZONE
            )
        """)
        cur.execute(f"TRUNCATE TABLE {summary_table}")
    conn.commit()
    log.info("已初始化 %d 张日表 + %s 汇总表", len(dates), summary_table)


def insert_rows(conn, table: str, rows: list[tuple]):
    """批量插入数据行"""
    if not rows:
        return
    with conn.cursor() as cur:
        sql = f"INSERT INTO {table} (longitude, latitude, xco2, time) VALUES (%s, %s, %s, %s)"
        cur.executemany(sql, rows)
    conn.commit()


# ── 主流程 ────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="OCO-2 / OCO-3 数据下载脚本 (全球范围)")
    parser.add_argument("--satellite", type=str, default="oco2", choices=["oco2", "oco3"],
                        help="选择卫星: oco2 (默认) 或 oco3")
    parser.add_argument("--dry-run", action="store_true", help="仅列出文件，不下载")
    parser.add_argument("--days", type=str, default="",
                        help="只处理指定日期，逗号分隔 (例如 --days 16,17,18)")
    parser.add_argument("--bbox", type=float, nargs=4, default=None,
                        metavar=("LON_MIN", "LAT_MIN", "LON_MAX", "LAT_MAX"),
                        help="可选空间范围 (默认: 全球无过滤)。示例: --bbox 70 15 140 55")
    parser.add_argument("--skip-download", action="store_true", help="跳过下载，仅入库缓存文件")
    args = parser.parse_args()

    validate_environment()
    import earthaccess
    import xarray as xr
    import psycopg2

    # ── 选择卫星数据集 ──
    ds_config = DATASETS[args.satellite]
    short_name = ds_config["short_name"]
    version = ds_config["version"]
    prefix = ds_config["table_prefix"]
    summary_table = f"{prefix}_data"

    # ── 1. NASA Earthdata 认证 ──
    log.info("正在认证 NASA Earthdata …")
    auth = earthaccess.login(strategy="interactive")
    if not auth.authenticated:
        log.error("Earthdata 认证失败。请检查 ~/.netrc 或手动登录。")
        sys.exit(1)
    log.info("认证成功")

    # ── 2. 搜索数据 ──
    target_days = [int(x.strip()) for x in args.days.split(",") if x.strip()] if args.days else []
    dates = [date(2024, 3, d) for d in target_days] if target_days else [
        START_DATE + date.resolution * i for i in range((END_DATE - START_DATE).days + 1)
    ]
    log.info("卫星: %s | 目标日期: %s", args.satellite.upper(), ", ".join(d.strftime("%m-%d") for d in dates))

    temporal = (START_DATE.strftime("%Y-%m-%d"), END_DATE.strftime("%Y-%m-%d"))
    log.info("正在搜索 %s V%s (%s → %s) …", short_name, version, temporal[0], temporal[1])

    # 构建搜索参数: 默认不加 bounding_box = 全球搜索
    search_kwargs = {
        "short_name": short_name,
        "version": version,
        "temporal": temporal,
        "count": 500,
    }
    if args.bbox is not None:
        search_kwargs["bounding_box"] = (args.bbox[0], args.bbox[1], args.bbox[2], args.bbox[3])
    else:
        log.info("无空间过滤 — 下载全球数据")
        # 使用全球范围确保 CMR API 返回所有 granule
        search_kwargs["bounding_box"] = (-180, -90, 180, 90)

    results = earthaccess.search_data(**search_kwargs)
    log.info("找到 %d 个 granule", len(results))

    if args.dry_run:
        for r in results:
            print(f"  {r['umm']['GranuleUR']}")
        log.info("Dry-run 完成，未下载任何文件。")
        return

    # ── 3. 下载文件 ──
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    if not args.skip_download:
        log.info("正在下载文件到 %s …", CACHE_DIR)
        downloaded = earthaccess.download(results, str(CACHE_DIR))
        log.info("下载完成: %d 个文件", len(downloaded))

    # ── 4. 连接数据库 ──
    log.info("正在连接 PostgreSQL …")
    conn = psycopg2.connect(**DB_CONFIG)
    ensure_tables(conn, dates, prefix)

    # ── 5. 解析 netCDF 并入库 ──
    nc_files = sorted(CACHE_DIR.glob("*.nc4"))
    if not nc_files:
        nc_files = sorted(CACHE_DIR.glob("*.nc"))
    log.info("找到 %d 个 netCDF 文件", len(nc_files))

    use_bbox = args.bbox is not None
    if use_bbox:
        lon_min, lat_min, lon_max, lat_max = args.bbox
    total_inserted = 0

    for nc_path in nc_files:
        log.info("处理: %s", nc_path.name)
        try:
            ds = xr.open_dataset(nc_path, group="RetrievalResults")
        except Exception:
            ds = xr.open_dataset(nc_path)

        # 变量名检测 (OCO-2 / OCO-3 Lite 文件变量名一致)
        lon_var = "longitude" if "longitude" in ds else "lon"
        lat_var = "latitude"  if "latitude"  in ds else "lat"
        xco2_var = "xco2"     if "xco2"      in ds else "XCO2"

        if xco2_var not in ds:
            log.warning("  跳过 %s: 找不到 xco2 变量 (可用变量: %s)", nc_path.name, list(ds.variables.keys())[:10])
            continue

        df = ds[[lon_var, lat_var, xco2_var]].to_dataframe().dropna()
        df = df.reset_index()

        has_time = any(c.lower() == "time" for c in df.columns)

        # 可选空间过滤
        if use_bbox:
            mask = (
                (df[lon_var] >= lon_min) & (df[lon_var] <= lon_max) &
                (df[lat_var] >= lat_min) & (df[lat_var] <= lat_max)
            )
            df = df[mask]
            log.info("  空间过滤后保留 %d 行 (bbox: %.0f°–%.0f°E, %.0f°–%.0f°N)", len(df), lon_min, lon_max, lat_min, lat_max)
        else:
            log.info("  全球数据: %d 行 (无空间过滤)", len(df))

        # 按日期分组写入日表
        for d in dates:
            tbl = table_name_for_date(d, prefix)

            if has_time:
                day_rows = df[
                    (df["time"] >= f"{d}T00:00:00") &
                    (df["time"] < f"{date.fromordinal(d.toordinal() + 1)}T00:00:00")
                ]
            else:
                fname = nc_path.stem.lower()
                date_str = d.strftime("%y%m%d")
                if date_str in fname:
                    day_rows = df
                else:
                    day_rows = df.head(0)

            if len(day_rows) == 0:
                continue

            rows = [
                (float(r[lon_var]), float(r[lat_var]), float(r[xco2_var]),
                 d.isoformat() if not has_time else str(r["time"]))
                for _, r in day_rows.iterrows()
            ]
            insert_rows(conn, tbl, rows)
            log.info("  → %s: 插入 %d 行", tbl, len(rows))
            total_inserted += len(rows)

        # 写入汇总表
        if has_time:
            all_rows = [
                (float(r[lon_var]), float(r[lat_var]), float(r[xco2_var]), str(r["time"]))
                for _, r in df.iterrows()
            ]
        else:
            first_date = dates[0]
            all_rows = [
                (float(r[lon_var]), float(r[lat_var]), float(r[xco2_var]), first_date.isoformat())
                for _, r in df.iterrows()
            ]
        insert_rows(conn, summary_table, all_rows)

        ds.close()

    # ── 6. 验证 ──
    log.info("── 入库验证 ──")
    with conn.cursor() as cur:
        for d in dates:
            tbl = table_name_for_date(d, prefix)
            cur.execute(f"SELECT COUNT(*) FROM {tbl}")
            cnt = cur.fetchone()[0]
            log.info("  %s: %d 行", tbl, cnt)
        cur.execute(f"SELECT COUNT(*) FROM {summary_table}")
        log.info("  %s (汇总): %d 行", summary_table, cur.fetchone()[0])

    conn.close()
    log.info("完成! 共插入 %d 行数据到 %d 张日表中。", total_inserted, len(dates))


if __name__ == "__main__":
    main()
