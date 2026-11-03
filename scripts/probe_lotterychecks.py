"""Read-only live contract check. Never dispatch notifications or write runtime data."""
import datetime
import json
from pathlib import Path
import sys
import urllib.error
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lottery_checker import LOTTERYCHECKS_ROUNDS, parse_lotterychecks_round


def main():
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=7))).date()
    passed = True
    for slug in LOTTERYCHECKS_ROUNDS:
        url = f'https://lotterychecks.com/api/public/results?lottery={slug}&date={today.isoformat()}&limit=1'
        report = {'lottery': slug, 'requestedDate': today.isoformat()}
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'LotteryAlert/1.0', 'Accept': 'application/json'})
            with urllib.request.urlopen(request, timeout=15) as response:
                report['httpStatus'] = response.status
                raw = response.read(65537)
                if len(raw) > 65536:
                    raise ValueError('Response exceeds public single-draw size limit')
                data = json.loads(raw)
            # Print only selected public result fields; never environment or credentials.
            records = data.get('data') if isinstance(data, dict) else None
            report['records'] = [{key: record.get(key) for key in
                                  ('lottery', 'lotteryName', 'drawDate', 'status', 'pendingPrizes', 'publishedAt', 'prizes')}
                                 for record in records[:2] if isinstance(record, dict)] if isinstance(records, list) else []
            report['contractPassed'] = bool(parse_lotterychecks_round(data, slug, today))
        except urllib.error.HTTPError as error:
            report.update(httpStatus=error.code, contractPassed=False, error='HTTPError')
        except Exception as error:
            report.update(contractPassed=False, error=type(error).__name__)
        print(json.dumps(report, ensure_ascii=True), flush=True)
        passed = passed and report['contractPassed']
    return 0 if passed else 1


if __name__ == '__main__':
    raise SystemExit(main())
