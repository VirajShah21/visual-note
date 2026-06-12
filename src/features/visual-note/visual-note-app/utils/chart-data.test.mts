import assert from "node:assert/strict"
import test from "node:test"
import { chartDataLayoutFrom, chartDatasetFromSheet, chartSheetFromData, chartTypeFrom } from "./chart-data.ts"

test("normalizes legacy label/value chart data into a columns sheet", () => {
    const sheet = chartSheetFromData({
        data: [
            { label: "Mon", value: 4 },
            { label: "Tue", value: "7" },
        ],
    })

    assert.deepEqual(
        sheet.slice(0, 3).map(row => row.slice(0, 2)),
        [
            ["", "Value"],
            ["Mon", "4"],
            ["Tue", "7"],
        ],
    )
})

test("extracts column-oriented sheet data as x labels with multiple y series", () => {
    const dataset = chartDatasetFromSheet(
        [
            ["", "Actual", "Target", ""],
            ["Mon", "4", "6", ""],
            ["Tue", "7", "8", ""],
            ["", "", "", ""],
        ],
        "columns",
    )

    assert.deepEqual(dataset, {
        labels: ["Mon", "Tue"],
        series: [
            { name: "Actual", values: [4, 7] },
            { name: "Target", values: [6, 8] },
        ],
    })
})

test("extracts row-oriented sheet data as x labels with multiple y series", () => {
    const dataset = chartDatasetFromSheet(
        [
            ["", "Mon", "Tue", ""],
            ["Actual", "4", "7", ""],
            ["Target", "6", "8", ""],
            ["", "", "", ""],
        ],
        "rows",
    )

    assert.deepEqual(dataset, {
        labels: ["Mon", "Tue"],
        series: [
            { name: "Actual", values: [4, 7] },
            { name: "Target", values: [6, 8] },
        ],
    })
})

test("parses chart layout dropdown values", () => {
    assert.equal(chartDataLayoutFrom("rows"), "rows")
    assert.equal(chartDataLayoutFrom("columns"), "columns")
    assert.equal(chartDataLayoutFrom("unexpected"), "columns")
})

test("parses chart type dropdown values", () => {
    assert.equal(chartTypeFrom("bar"), "bar")
    assert.equal(chartTypeFrom("line"), "line")
    assert.equal(chartTypeFrom("area"), "area")
    assert.equal(chartTypeFrom("scatter"), "scatter")
    assert.equal(chartTypeFrom("pie"), "pie")
    assert.equal(chartTypeFrom("unexpected"), "bar")
})
