import assert from "node:assert/strict"
import test from "node:test"
import { chartDatasetFromData, compactChartSheetFromData, minimumChartColumns, minimumChartRows } from "../../../../lib/visual-note/chart-data"
import { chartDataLayoutFrom, chartDatasetFromSheet, chartSheetFromData, chartTypeFrom } from "./chart-data"

test("pads current chart sheet data for the editor", () => {
    const data = {
        dataSheet: [
            ["", "Value"],
            ["Mon", "4"],
            ["Tue", "7"],
        ],
    }
    const compactSheet = compactChartSheetFromData(data)
    const sheet = chartSheetFromData(data)

    assert.deepEqual(compactSheet, [
        ["", "Value"],
        ["Mon", "4"],
        ["Tue", "7"],
    ])
    assert.equal(sheet.length, minimumChartRows)
    assert.equal(sheet[0]?.length, minimumChartColumns)
})

test("extracts compact shared chart data without editor padding", () => {
    const dataset = chartDatasetFromData({
        dataLayout: "rows",
        dataSheet: [
            ["", "Mon", "Tue", ""],
            ["Actual", "4", "7", ""],
            ["Target", "6", "8", ""],
        ],
    })

    assert.deepEqual(dataset, {
        labels: ["Mon", "Tue"],
        series: [
            { name: "Actual", values: [4, 7] },
            { name: "Target", values: [6, 8] },
        ],
    })
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
