#!/usr/bin/env python3
"""
GEE Python Bridge — 使用 Earth Engine Python SDK 调用 computePixels REST API。

Node.js 无法直接序列化 EE 计算图，因此通过 Python SDK 桥接。

用法:
    python gee-bridge.py <dataset> <year> <minLon> <minLat> <maxLon> <maxLat> [--key <path>] [--proxy <url>]

输出:
    GeoJSON FeatureCollection 到 stdout

环境变量:
    HTTPS_PROXY — 代理 URL (如 http://127.0.0.1:10809)
    GEE_SERVICE_ACCOUNT_KEY — 服务账号 JSON 密钥路径
"""

import sys
import json
import os
import argparse

import ee

# ---------------------------------------------------------------------------
# 数据集 → GEE ImageCollection 映射 (同 Node.js 版本)
# ---------------------------------------------------------------------------
DATASET_MAP = {
    "ndvi": {
        "collection": "MODIS/061/MOD13Q1",
        "band": "NDVI",
        "reducer": "mean",
        "scale": 250,
        "range": [0, 1],
        "unit": "dimensionless",
        "scale_factor": 0.0001,
        "offset": 0,
    },
    "gpp": {
        "collection": "MODIS/061/MOD17A2H",
        "collection_alt": "MODIS/006/MOD17A2H",  # v006 覆盖 2000-2020
        "band": "Gpp",
        "reducer": "sum",
        "scale": 500,
        "range": [0, 3000],
        "unit": "gC/m²/year",
        "scale_factor": 0.0001,
        "offset": 0,
        "version_year": 2021,  # 2021+ 用 v061, 之前用 v006
    },
    "npp": {
        "collection": "MODIS/061/MOD17A3HGF",
        "band": "Npp",
        "reducer": "mean",
        "scale": 500,
        "range": [0, 2000],
        "unit": "gC/m²/year",
        "scale_factor": 0.0001,
        "offset": 0,
    },
    "tudi": {
        "collection": "MODIS/061/MCD12Q1",
        "band": "LC_Type1",
        "reducer": "mode",
        "scale": 500,
        "range": [1, 17],
        "unit": "class",
        "scale_factor": 1,
        "offset": 0,
    },
    "temp1": {
        "collection": "ECMWF/ERA5_LAND/MONTHLY_AGGR",
        "band": "temperature_2m",
        "reducer": "mean",
        "scale": 11132,
        "range": [-30, 40],
        "unit": "℃",
        "scale_factor": 1,
        "offset": -273.15,  # K → ℃
        "month": 1,
    },
    "temp7": {
        "collection": "ECMWF/ERA5_LAND/MONTHLY_AGGR",
        "band": "temperature_2m",
        "reducer": "mean",
        "scale": 11132,
        "range": [-10, 50],
        "unit": "℃",
        "scale_factor": 1,
        "offset": -273.15,
        "month": 7,
    },
    "pre": {
        "collection": "ECMWF/ERA5_LAND/MONTHLY_AGGR",
        "band": "total_precipitation_sum",
        "reducer": "sum",
        "scale": 11132,
        "range": [0, 3000],
        "unit": "mm",
        "scale_factor": 1000,  # m → mm
        "offset": 0,
    },
    "population": {
        "collection": "WorldPop/GP/100m/pop",
        "band": "population",
        "reducer": "mean",
        "scale": 100,
        "range": [0, 50000],
        "unit": "people/km²",
        "scale_factor": 1,
        "offset": 0,
    },
    "zhibei": {
        "collection": "MODIS/061/MOD44B",
        "band": "Percent_Tree_Cover",
        "reducer": "mean",
        "scale": 250,
        "range": [0, 100],
        "unit": "%",
        "scale_factor": 1,
        "offset": 0,
    },
}


def authenticate(key_path):
    """使用服务账号 JSON 密钥认证"""
    if not os.path.exists(key_path):
        raise FileNotFoundError(f"Service account key not found: {key_path}")

    with open(key_path, "r") as f:
        key_data = json.load(f)

    credentials = ee.ServiceAccountCredentials(
        key_data["client_email"], key_path
    )
    ee.Initialize(credentials, project=key_data["project_id"])
    print(f"[GEE-Python] 认证成功: {key_data['client_email']}", file=sys.stderr)


def build_image(ds_meta, year, bbox):
    """构建 Earth Engine Image 计算"""
    collection = ds_meta["collection"]
    version_year = ds_meta.get("version_year")
    collection_alt = ds_meta.get("collection_alt")

    # 处理数据集版本切换 (如 MOD17A2H: v006 → v061)
    if version_year and collection_alt and year < version_year:
        collection = collection_alt

    band = ds_meta["band"]
    reducer = ds_meta["reducer"]
    scale_factor = ds_meta.get("scale_factor", 1)
    offset = ds_meta.get("offset", 0)
    month = ds_meta.get("month")

    col = ee.ImageCollection(collection)
    col = col.filterDate(f"{year}-01-01", f"{year}-12-31")
    col = col.select(band)

    # 月份过滤
    if month is not None:
        col = col.filter(ee.Filter.calendarRange(month, month, "month"))

    # Reduce
    if reducer == "mode":
        result = col.mode()
    elif reducer == "mean":
        result = col.mean()
    elif reducer == "sum":
        result = col.sum()
    else:
        result = col.mean()

    # 应用 scale factor 和偏移
    if scale_factor != 1:
        result = result.multiply(scale_factor)
    if offset != 0:
        result = result.add(offset)

    # 裁剪到 bbox
    geom = ee.Geometry.Rectangle(
        [bbox["minLon"], bbox["minLat"], bbox["maxLon"], bbox["maxLat"]]
    )
    result = result.clip(geom)

    return result


def compute_pixels(image, ds_meta, bbox):
    """调用 ee.data.computePixels 获取像素数据（使用 NUMPY_NDARRAY 格式）"""
    scale = ds_meta["scale"]

    # 计算网格尺寸 (限制最大 500x500)
    lon_span = bbox["maxLon"] - bbox["minLon"]
    lat_span = bbox["maxLat"] - bbox["minLat"]
    width = min(500, int(lon_span * 111320 / scale))
    height = min(500, int(lat_span * 110574 / scale))
    width = max(1, width)
    height = max(1, height)

    request = {
        "expression": image,  # ee.Image 对象，SDK 自动序列化
        "fileFormat": "NUMPY_NDARRAY",
        "grid": {
            "dimensions": {"width": width, "height": height},
            "affineTransform": {
                "scaleX": lon_span / width,
                "shearX": 0,
                "translateX": bbox["minLon"],
                "shearY": 0,
                "scaleY": -lat_span / height,  # 注意：EE 中 Y 轴向下
                "translateY": bbox["maxLat"],
            },
            "crsCode": "EPSG:4326",
        },
    }

    print(f"[GEE-Python] 请求 {ds_meta['collection']}/{ds_meta['band']} "
          f"({width}x{height})...", file=sys.stderr)

    result = ee.data.computePixels(request)
    return result, width, height


def convert_to_geojson(pixels, dataset, year, ds_meta, bbox, width, height):
    """将 computePixels 返回的 NumPy 数组转换为标准 GeoJSON FeatureCollection"""
    import numpy as np

    features = []

    # NUMPY_NDARRAY 格式可能有两种：
    # 1. 结构化数组 with row/col fields: dtype = [('row', '<i4'), ('col', '<i4'), ('band', '<f8')]
    # 2. 2D 结构化数组: shape=(H,W), dtype = [('band', '<f8')]
    if isinstance(pixels, np.ndarray):
        print(
            f"[GEE-Python] NumPy array shape={pixels.shape}, dtype={pixels.dtype}",
            file=sys.stderr,
        )

        band_name = ds_meta["band"]
        lon_span = bbox["maxLon"] - bbox["minLon"]
        lat_span = bbox["maxLat"] - bbox["minLat"]

        # 情况 1：有 row/col 字段的结构化数组
        if pixels.dtype.names and "row" in pixels.dtype.names:
            data_cols = [
                name for name in pixels.dtype.names
                if name not in ("row", "col", "pixel_quality")
            ]
            if data_cols:
                band_name = data_cols[0]

            for rec in pixels:
                row, col = int(rec["row"]), int(rec["col"])
                val = float(rec[band_name])
                if np.isnan(val) or np.isinf(val):
                    continue
                lon = bbox["minLon"] + (col + 0.5) * lon_span / width
                lat = bbox["maxLat"] - (row + 0.5) * lat_span / height
                features.append(
                    {
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [lon, lat]},
                        "properties": {
                            "value": val,
                            "year": year,
                            "dataset": dataset,
                        },
                    }
                )
        else:
            # 情况 2：2D 结构化数组，(rows, cols) 带命名字段
            data_cols = list(pixels.dtype.names) if pixels.dtype.names else ["value"]
            band_name = data_cols[0]
            n_rows, n_cols = pixels.shape

            for i in range(n_rows):
                for j in range(n_cols):
                    val = float(pixels[i, j][band_name])
                    if np.isnan(val) or np.isinf(val):
                        continue
                    lon = bbox["minLon"] + (j + 0.5) * lon_span / n_cols
                    lat = bbox["maxLat"] - (i + 0.5) * lat_span / n_rows
                    features.append(
                        {
                            "type": "Feature",
                            "geometry": {"type": "Point", "coordinates": [lon, lat]},
                            "properties": {
                                "value": val,
                                "year": year,
                                "dataset": dataset,
                            },
                        }
                    )

    elif isinstance(pixels, dict):
        # Fallback for other response formats
        if "data" in pixels and isinstance(pixels["data"], list):
            data = pixels["data"]
        elif "features" in pixels and isinstance(pixels["features"], list):
            # 已经是 GeoJSON 格式
            for i, feat in enumerate(pixels["features"]):
                props = feat.get("properties", {})
                value = (
                    props.get(ds_meta["band"])
                    or props.get("value")
                    or (list(props.values())[0] if props else 0)
                )
                features.append(
                    {
                        "type": "Feature",
                        "id": i,
                        "geometry": feat.get("geometry"),
                        "properties": {
                            "value": value,
                            "year": year,
                            "dataset": dataset,
                        },
                    }
                )
            return {
                "type": "FeatureCollection",
                "features": features,
                "metadata": {
                    "dataset": dataset,
                    "year": year,
                    "provider": "gee",
                    "collection": ds_meta["collection"],
                    "band": ds_meta["band"],
                    "unit": ds_meta["unit"],
                    "range": ds_meta["range"],
                },
            }
        else:
            print(
                f"[GEE-Python] 未知响应格式: {type(pixels)}",
                file=sys.stderr,
            )
            return None

        # 处理 data 数组格式
        n_rows = len(data)
        if n_rows == 0:
            return None

        lon_span = bbox["maxLon"] - bbox["minLon"]
        lat_span = bbox["maxLat"] - bbox["minLat"]

        for row_idx, row in enumerate(data):
            n_cols = len(row) if isinstance(row, list) else 1
            for col_idx in range(n_cols):
                val = row[col_idx] if isinstance(row, list) else row
                if val is None:
                    continue

                lon = bbox["minLon"] + (col_idx + 0.5) * lon_span / n_cols
                lat = bbox["maxLat"] - (row_idx + 0.5) * lat_span / n_rows

                features.append(
                    {
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [lon, lat]},
                        "properties": {
                            "value": float(val),
                            "year": year,
                            "dataset": dataset,
                        },
                    }
                )
    else:
        print(
            f"[GEE-Python] 未知响应类型: {type(pixels)}",
            file=sys.stderr,
        )
        return None

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "dataset": dataset,
            "year": year,
            "provider": "gee",
            "collection": ds_meta["collection"],
            "band": ds_meta["band"],
            "unit": ds_meta["unit"],
            "range": ds_meta["range"],
        },
    }


def main():
    parser = argparse.ArgumentParser(description="GEE Python Bridge")
    parser.add_argument("dataset", help="数据集 ID (ndvi, gpp, npp, ...)")
    parser.add_argument("year", type=int, help="年份 (2000-2020)")
    parser.add_argument("minLon", type=float, help="最小经度")
    parser.add_argument("minLat", type=float, help="最小纬度")
    parser.add_argument("maxLon", type=float, help="最大经度")
    parser.add_argument("maxLat", type=float, help="最大纬度")
    parser.add_argument(
        "--key",
        default=os.environ.get(
            "GEE_SERVICE_ACCOUNT_KEY",
            os.path.join(os.path.dirname(__file__), "..", "cbigdata-gee-605ad04eea1d.json"),
        ),
        help="服务账号 JSON 密钥路径",
    )
    args = parser.parse_args()

    ds_meta = DATASET_MAP.get(args.dataset)
    if not ds_meta:
        print(json.dumps({"error": f"Unknown dataset: {args.dataset}"}))
        sys.exit(1)

    bbox = {
        "minLon": args.minLon,
        "minLat": args.minLat,
        "maxLon": args.maxLon,
        "maxLat": args.maxLat,
    }

    try:
        authenticate(args.key)
        image = build_image(ds_meta, args.year, bbox)
        pixels, width, height = compute_pixels(image, ds_meta, bbox)
        geojson = convert_to_geojson(pixels, args.dataset, args.year, ds_meta, bbox, width, height)

        if geojson is None:
            print(json.dumps({"error": "Failed to convert GEE response"}))
            sys.exit(1)

        print(json.dumps(geojson))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
