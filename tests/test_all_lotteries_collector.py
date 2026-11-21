"""Regression and unit tests for the 54-lottery collector and validator."""

import datetime
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import collect_all_lotteries as collector  # noqa: E402
import lottery_sources as sources  # noqa: E402
import validate_all_lotteries as validator  # noqa: E402

CATALOG = json.loads((ROOT / "data" / "all_lotteries.json").read_text(encoding="utf-8"))

EXPECTED_IDS = [
    "lao_extra", "nikkei_vip_morning", "hanoi_asean", "nikkei_morning", "china_vip_morning",
    "china_morning", "lao_tv", "hangseng_vip_morning", "hangseng_morning", "hanoi_hd",
    "taiwan_vip", "hanoi_star", "taiwan", "korea_vip", "korea", "nikkei_afternoon",
    "nikkei_vip_afternoon", "lao_hd", "china_afternoon", "hanoi_tv", "china_vip_afternoon",
    "hangseng_afternoon", "hangseng_vip_afternoon", "lao_star", "singapore",
    "thai_stock_evening", "hanoi_redcross", "india", "singapore_vip", "hanoi_samakki",
    "hanoi_special", "hanoi_regular", "hanoi_vip", "hanoi_patthana", "lao_patthana",
    "lao_samakki", "lao_asean", "lao_vip", "lao_samakki_vip", "england_vip", "lao_star_vip",
    "hanoi_extra", "england", "germany", "russia", "germany_vip", "lao_redcross",
    "russia_vip", "dowjones_vip", "dowjones_star", "dowjones", "thai_gov", "gsb", "baac",
]

TLA_PAYLOAD = {
    "ok": True,
    "categories": {
        "lottothaihot": {
            "items": [
                {"key": "thailotto", "label": "หวยรัฐบาลไทย", "drawDate": "2026-11-16T00:00:00+07:00",
                 "result": "645654", "top3": "654", "bottom2": "06"},
                {"key": "gsblotto", "label": "หวยออมสิน", "drawDate": "2026-11-16T00:00:00+07:00",
                 "result": "980716, 126907", "top3": "716", "bottom2": "07"},
            ]
        },
        "stock": {
            "items": [
                {"key": "stockthai4", "label": "หวยหุ้นไทยเย็น", "drawDate": "2026-11-20T00:00:00+07:00",
                 "result": "028", "top3": "028", "bottom2": "36"},
                {"key": "stockrussia", "label": "หวยหุ้นรัสเซีย", "drawDate": "2026-11-20",
                 "result": "", "top3": "", "bottom2": ""},
            ]
        },
    },
}

PAGE_HTML = """
<html><head><title>ผลหวยลาว Extra</title></head><body>
<p>ผล หวยลาว Extra วันนี้ ออกรางวัลทุกวัน เวลา 08:30 น. งวด 20 พฤศจิกายน 2569
รางวัลพิเศษ 32680 3 ตัวบน 680 2 ตัวล่าง 32</p>
<table><tr><td>งวดวันที่ 19 พฤศจิกายน 2569</td><td>88580</td><td>580</td><td>88</td></tr></table>
</body></html>
"""

STOCK_HTML = """
<html><body>
<h2>หวยหุ้นต่างประเทศ</h2>
<h3>หวยหุ้นนิคเคอิเช้า</h3>
<div>งวด 20 พฤศจิกายน 2569 3 ตัวบน 504 2 ตัวล่าง 17</div>
<h2>หวยหุ้น VIP</h2>
<h3>หวยหุ้นนิคเคอิ VIP เช้า</h3>
<div>งวด 20 พฤศจิกายน 2569 3 ตัวบน 385 2 ตัวล่าง 98</div>
<h2>หวยหุ้นพิเศษ</h2>
<h3>หวยหุ้นอังกฤษพิเศษ</h3>
<div>งวด 20 พฤศจิกายน 2569 3 ตัวบน 633 2 ตัวล่าง 26</div>
</body></html>
"""


def test_thai_and_iso_dates_parse():
    assert sources.thai_date_to_iso("20 พฤศจิกายน 2569") == "2026-11-20"
    assert sources.thai_date_to_iso("2026-11-16T00:00:00+07:00") == "2026-11-16"
    assert sources.thai_date_to_iso("20.11.2026") == "2026-11-20"
    assert sources.thai_date_to_iso("ไม่ระบุ") == ""
    assert sources.iso_to_thai_date("2026-11-20") == "20 พฤศจิกายน 2569"


def test_digits_keep_leading_zeros():
    assert sources.digits("028", 3) == "028"
    assert sources.digits("06", 2) == "06"
    assert sources.digits("8", 2) == ""
    assert sources.digits(None, 2) == ""


def test_parse_thailottoapi_keeps_zero_padded_numbers_and_skips_empty():
    records = sources.parse_thailottoapi(TLA_PAYLOAD)
    assert records["stockthai4"].top3 == "028"
    assert records["stockthai4"].bottom2 == "36"
    assert records["thailotto"].first_prize == "645654"
    assert "stockrussia" not in records
    assert records["thailotto"].draw_date == "2026-11-16"


def test_parse_pholhuay_page_reads_latest_block_only():
    record = sources.parse_pholhuay_page(PAGE_HTML, "https://example.test/lao-lottery/extra")
    assert record.top3 == "680"
    assert record.bottom2 == "32"
    assert record.first_prize == "32680"
    assert record.draw_date == "2026-11-20"
    assert "example.test" in record.source


def test_parse_pholhuay_page_returns_none_without_result_block():
    assert sources.parse_pholhuay_page("<html><body>no result</body></html>", "u") is None


def test_stock_groups_are_separated():
    rows = sources.parse_pholhuay_stock_groups(STOCK_HTML, "https://example.test/stock-lottery")
    groups = {(row.extra["group"], row.label): (row.top3, row.bottom2) for row in rows}
    assert groups[("stock", "หวยหุ้นนิคเคอิเช้า")] == ("504", "17")
    assert groups[("stock_vip", "หวยหุ้นนิคเคอิ VIP เช้า")] == ("385", "98")
    assert groups[("stock_special", "หวยหุ้นอังกฤษพิเศษ")] == ("633", "26")


def test_resolve_reports_reason_for_unmapped_lottery():
    result, reason = sources.resolve("not_in_catalog", {"tla": {}, "stocks": [], "pages": {}, "checks": {}})
    assert result is None
    assert reason


def test_lotterychecks_specs_stay_pinned():
    expected = {
        "hanoi_hd": ("hanoi-hd", "/vietnam/hd"),
        "lao_samakki": ("lao-union", "/laos/union"),
        "england_vip": ("", "/stock-markets/england-vip"),
        "germany_vip": ("", "/stock-markets/germany-vip"),
        "russia_vip": ("", "/stock-markets/russia-vip"),
        "dowjones_vip": ("", "/stock-markets/dowjones-vip"),
        "dowjones_star": ("", "/stock-markets/dowjonestar"),
    }
    for catalog_id, spec in expected.items():
        assert sources.CATALOG_SOURCES[catalog_id] == ("checks", *spec)


def test_every_catalog_id_has_a_source():
    catalog = collector.load_catalog()
    assert not [row["id"] for row in catalog if row["id"] not in sources.CATALOG_SOURCES]


def test_parse_lotterychecks_payload_reads_top_and_bottom():
    payload = {"data": [{
        "lottery": "hanoi-hd",
        "lotteryName": "หวยฮานอย HD",
        "drawDate": "2026-11-21",
        "prizes": [
            {"slug": "special-prize", "numbers": ["53210"]},
            {"slug": "three-digit-top", "numbers": ["210"]},
            {"slug": "two-digit-bottom", "numbers": ["84"]},
        ],
    }]}
    record = sources.parse_lotterychecks_payload(payload, "https://lotterychecks.com/vietnam/hd")
    assert (record.top3, record.bottom2, record.draw_date, record.first_prize) == ("210", "84", "2026-11-21", "53210")
    result = record.as_result()
    assert result["top3"] == "210"
    assert result["bottom2"] == "84"
    assert result["specialPrize"] == "53210"
    assert "lotterychecks.com/vietnam/hd" in result["source"]


def test_parse_lotterychecks_page_reads_the_headline_round():
    html = ('<div>หวยหุ้นอังกฤษ VIP ออก 21:50 น. ออกผลแล้ว งวด 20 พฤศจิกายน 2569 '
            '3 ตัวบน 918 2 ตัวล่าง 59</div>'
            '<table><tr><td>งวดวันที่ 19 พฤศจิกายน 2569</td><td>510</td><td>97</td></tr></table>')
    record = sources.parse_lotterychecks_page(html, "https://lotterychecks.com/stock-markets/england-vip")
    assert (record.top3, record.bottom2, record.draw_date) == ("918", "59", "2026-11-20")
    assert record.as_result()["date"] == "20 พฤศจิกายน 2569"


def test_parse_lotterychecks_page_returns_none_when_no_result_block():
    assert sources.parse_lotterychecks_page("<div>ยังไม่ออกผล</div>", "u") is None


def test_resolve_uses_lotterychecks_record():
    record = sources.Record(top3="918", bottom2="59", draw_date="2026-11-20", source="LotteryChecks")
    result, reason = sources.resolve(
        "england_vip",
        {"tla": {}, "stocks": [], "pages": {}, "checks": {"/stock-markets/england-vip": record}},
    )
    assert reason == ""
    assert result["top3"] == "918"


def test_resolve_reports_reason_when_lotterychecks_page_is_missing():
    result, reason = sources.resolve("england_vip", {"tla": {}, "stocks": [], "pages": {}, "checks": {}})
    assert result is None
    assert "LotteryChecks" in reason


def test_resolve_reports_reason_when_source_is_empty():
    result, reason = sources.resolve("thai_gov", {"tla": {}, "stocks": [], "pages": {}})
    assert result is None
    assert "stocknikkei" not in reason
    assert reason


def test_apply_results_marks_verified_and_missing():
    catalog = json.loads(json.dumps(collector.load_catalog()))
    blank = {"status": "waiting", "top3": "", "bottom2": "", "firstPrize": "",
             "date": "", "drawDate": "", "source": "", "specialPrize": ""}
    next(row for row in catalog if row["id"] == "dowjones_star").update(blank)
    src = {
        "tla": sources.parse_thailottoapi(TLA_PAYLOAD),
        "stocks": sources.parse_pholhuay_stock_groups(STOCK_HTML),
        "pages": {"/lao-lottery/extra": sources.parse_pholhuay_page(PAGE_HTML, "u")},
    }
    updated, evidence = collector.apply_results(catalog, src, datetime.date(2026, 11, 21))
    by_id = {row["id"]: row for row in updated}
    assert by_id["lao_extra"]["status"] == "announced"
    assert by_id["lao_extra"]["top3"] == "680"
    assert by_id["lao_extra"]["date"] == "20 พฤศจิกายน 2569"
    assert by_id["thai_gov"]["status"] == "announced"
    assert by_id["thai_gov"]["firstPrize"] == "645654"
    assert by_id["dowjones_star"]["status"] == "waiting"
    assert by_id["dowjones_star"]["top3"] == ""
    verified = {row["id"] for row in evidence if row["status"] == "verified"}
    assert {"lao_extra", "thai_gov"} <= verified
    assert all(row.get("reason") for row in evidence if row["status"] == "not_found")


def test_apply_results_rejects_future_draw_date():
    catalog = collector.load_catalog()
    src = {"tla": sources.parse_thailottoapi(TLA_PAYLOAD), "stocks": [], "pages": {}}
    updated, evidence = collector.apply_results(catalog, src, datetime.date(2026, 11, 1))
    # The only result on offer is dated after "today", so the stored value is kept.
    assert {row["id"]: row for row in updated}["thai_gov"]["status"] == "announced"
    assert {row["id"]: row for row in updated}["thai_gov"]["top3"] == "654"
    assert {row["id"]: row for row in evidence}["thai_gov"]["status"] == "retained"


def test_transient_source_failure_keeps_verified_results():
    catalog = collector.load_catalog()
    before = {row["id"]: dict(row) for row in catalog if row["status"] == "announced"}
    assert before, "the catalog under test needs at least one verified result"
    updated, evidence = collector.apply_results(catalog, {"tla": {}, "stocks": [], "pages": {}},
                                                datetime.date(2026, 11, 21))
    by_id = {row["id"]: row for row in updated}
    for lottery_id, snapshot in before.items():
        assert by_id[lottery_id]["status"] == "announced"
        assert (by_id[lottery_id]["top3"], by_id[lottery_id]["bottom2"]) == (snapshot["top3"], snapshot["bottom2"])
        assert by_id[lottery_id]["date"] == snapshot["date"]
    states = {row["id"]: row["status"] for row in evidence}
    assert all(states[lottery_id] == "retained" for lottery_id in before)
    assert all(row.get("reason") for row in evidence if row["status"] in {"retained", "not_found"})
    # Retained rows stay publishable and never gain invented numbers.
    assert validator.validate_catalog(updated, datetime.date(2026, 11, 21)) == []


def test_waiting_row_is_cleared_only_when_nothing_was_ever_stored():
    catalog = collector.load_catalog()
    target = next(item for item in catalog if item["id"] == "dowjones_star")
    target.update({"status": "announced", "top3": "111", "bottom2": "22",
                   "firstPrize": "111", "date": "20 พฤศจิกายน 2569"})
    updated, evidence = collector.apply_results(catalog, {"tla": {}, "stocks": [], "pages": {}},
                                                datetime.date(2026, 11, 21))
    by_id = {row["id"]: row for row in updated}
    assert by_id["dowjones_star"]["top3"] == "111"
    assert {row["id"]: row for row in evidence}["dowjones_star"]["status"] == "retained"


def test_conflicting_sources_are_not_published():
    catalog = collector.load_catalog()
    conflicting_stock = STOCK_HTML.replace("3 ตัวบน 504 2 ตัวล่าง 17", "3 ตัวบน 999 2 ตัวล่าง 99")
    src = {
        "tla": sources.parse_thailottoapi(TLA_PAYLOAD),
        "stocks": sources.parse_pholhuay_stock_groups(conflicting_stock),
        "pages": {},
    }
    updated, evidence = collector.apply_results(catalog, src, datetime.date(2026, 11, 21))
    by_id = {row["id"]: row for row in updated}
    # nikkei is absent from the TLA fixture, so the disagreeing card is the only
    # offer; the stored value stays and the conflicting number is never published.
    assert by_id["nikkei_morning"]["status"] == "announced"
    assert by_id["nikkei_morning"]["top3"] == "504"
    states = {row["id"]: row["status"] for row in evidence}
    assert states["nikkei_morning"] == "retained"
    assert all(row.get("reason") for row in evidence if row["status"] in {"not_found", "retained"})


def test_cross_check_detects_mismatch():
    src = {
        "tla": {"stocknikkei1": sources.Record("504", "17", "2026-11-20", "tla")},
        "stocks": [sources.Record("385", "98", "2026-11-20", "ph", label="หวยหุ้นนิคเคอิเช้า",
                                 extra={"group": "stock"})],
        "pages": {},
    }
    message = collector.cross_check("nikkei_morning", src)
    assert "ขัดแย้ง" in message


def test_cross_check_agrees():
    src = {
        "tla": {"stocknikkei1": sources.Record("504", "17", "2026-11-20", "tla")},
        "stocks": [sources.Record("504", "17", "2026-11-20", "ph", label="หวยหุ้นนิคเคอิเช้า",
                                 extra={"group": "stock"})],
        "pages": {},
    }
    assert collector.cross_check("nikkei_morning", src) == ""


def test_strip_markup_drops_script_and_style_blocks():
    html = ('<div>ผลรางวัล</div><script type="text/javascript">var a = 1;</script >'
            '<style media="all">.x{color:red}</style ><p>3 ตัวบน 504</p>')
    text = sources.strip_markup(html)
    assert "var a" not in text
    assert "color:red" not in text
    assert "ผลรางวัล" in text
    assert "3 ตัวบน 504" in text


def test_atomic_write_replaces_file_without_partial_content(tmp_path):
    target = tmp_path / "data" / "all_lotteries.json"
    collector.atomic_write_json(target, [{"id": "a"}])
    collector.atomic_write_json(target, [{"id": "b"}])
    assert json.loads(target.read_text(encoding="utf-8")) == [{"id": "b"}]
    assert not [p for p in target.parent.iterdir() if p.name.endswith(".tmp")]


def test_collect_sources_swallows_source_failures(monkeypatch):
    def boom(*args, **kwargs):
        raise sources.SourceError("timeout")

    monkeypatch.setattr(sources, "fetch_thailottoapi", lambda **kwargs: ({}, ["timeout"]))
    monkeypatch.setattr(sources, "fetch_pholhuay_stock_groups", boom)
    monkeypatch.setattr(sources, "fetch_pholhuay_page", boom)
    monkeypatch.setattr(sources, "fetch_lotterychecks", boom)
    src, reasons = sources.collect_sources(days=1, today=datetime.date(2026, 11, 20))
    assert src == {"tla": {}, "stocks": [], "pages": {}, "checks": {}}
    assert any("timeout" in reason for reason in reasons)


def test_catalog_keeps_54_ids_in_order():
    assert [item["id"] for item in CATALOG] == EXPECTED_IDS
    assert len(CATALOG) == 54


def test_catalog_schema_keys_are_unchanged():
    for item in CATALOG:
        assert [key for key in item if key not in validator.OPTIONAL_KEYS] == validator.EXPECTED_KEYS
        assert all(key in validator.OPTIONAL_KEYS for key in item if key not in validator.EXPECTED_KEYS)


def test_validator_accepts_current_catalog():
    assert validator.validate_catalog(CATALOG) == []


def test_validator_rejects_duplicate_ids():
    broken = json.loads(json.dumps(CATALOG))
    broken[1]["id"] = broken[0]["id"]
    errors = validator.validate_catalog(broken)
    assert any("duplicate id" in error for error in errors)


def test_validator_rejects_announced_without_numbers():
    broken = json.loads(json.dumps(CATALOG))
    broken[0]["status"] = "announced"
    broken[0]["top3"] = "68"
    errors = validator.validate_catalog(broken)
    assert any("3-digit top3" in error for error in errors)


def test_validator_rejects_future_draw_date():
    broken = json.loads(json.dumps(CATALOG))
    broken[0].update({"status": "announced", "top3": "123", "bottom2": "45",
                      "firstPrize": "123", "date": "1 มกราคม 2571", "source": "test"})
    errors = validator.validate_catalog(broken, today=datetime.date(2026, 11, 21))
    assert any("future" in error for error in errors)


def test_validator_rejects_schema_drift():
    broken = json.loads(json.dumps(CATALOG))
    broken[0]["unexpected"] = "x"
    errors = validator.validate_catalog(broken)
    assert any("schema changed" in error for error in errors)


def test_validator_rejects_waiting_with_numbers():
    broken = json.loads(json.dumps(CATALOG))
    broken[0].update({"status": "waiting", "top3": "123"})
    errors = validator.validate_catalog(broken)
    assert any("waiting but top3" in error for error in errors)


def test_validator_checks_evidence_consistency():
    catalog = json.loads(json.dumps(CATALOG))
    evidence = {"items": [{"id": item["id"], "status": "not_found", "reason": "no source"}
                          for item in catalog]}
    waiting = json.loads(json.dumps(catalog[0]))
    waiting.update({"id": "synthetic_waiting", "status": "waiting", "top3": "", "bottom2": "",
                    "firstPrize": "", "date": "", "drawDate": "", "source": ""})
    catalog.append(waiting)
    evidence["items"].append({"id": waiting["id"], "status": "not_found", "reason": "no source"})
    assert validator.validate_evidence(evidence, catalog) == []
    evidence["items"] = [row for row in evidence["items"] if row["id"] != waiting["id"]]
    evidence["items"].append({"id": waiting["id"], "status": "verified",
                              "top3": "111", "bottom2": "22"})
    errors = validator.validate_evidence(evidence, catalog)
    assert any("verified but catalog is waiting" in error for error in errors)


def test_official_three_digit_prizes_survive_the_source_parser():
    """ThaiLottoAPI publishes bottom3 as a comma string; the catalog keeps it."""
    payload = {"categories": {"gov": {"items": [{
        "key": "government", "label": "สลากกินแบ่งรัฐบาล",
        "drawDate": "16 พฤศจิกายน 2569", "result": "645654", "top3": "654",
        "bottom3": "938, 101, 106, 782", "bottom2": "06",
    }]}}}
    record = sources.parse_thailottoapi(payload)["government"]
    assert record.three_digit_prizes == ("938", "101", "106", "782")
    result = record.as_result()
    assert result["threeDigits"] == ["938", "101", "106", "782"]
    assert result["top3"] == "654" and result["firstPrize"] == "645654"
    assert "back3" not in result and "front3" not in result


def test_digits_list_drops_duplicates_and_bad_widths():
    assert sources.digits_list("938, 938, 10, 101", 3) == ("938", "101")
    assert sources.digits_list(["001", "002"], 3) == ("001", "002")
    assert sources.digits_list(None, 3) == ()


def test_validator_accepts_and_checks_the_optional_prize_lists():
    catalog = [dict(item) for item in CATALOG]
    catalog[0]["threeDigits"] = ["938", "101"]
    assert not [e for e in validator.validate_catalog(catalog) if "threeDigits" in e]
    catalog[0]["threeDigits"] = ["93"]
    assert [e for e in validator.validate_catalog(catalog) if "threeDigits" in e]
