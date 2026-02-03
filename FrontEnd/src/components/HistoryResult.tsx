import { useAppSelector } from "@/redux/hooks";
import { ActionResult } from "@/types/backend";
import {
  Modal,
  List,
  Card,
  Tag,
  Space,
  Divider,
  Empty,
  Statistic,
  Progress,
  Row,
  Col,
  Radio,
} from "antd";
import { useState } from "react";

interface IProps {
  show: boolean;
  setShow: (v: boolean) => void;
}

type FilterType = "all" | "success" | "death";

const PAGE_SIZE = 3;

const HistoryResult = ({ show, setShow }: IProps) => {
  const results: (ActionResult & { runIndex: number })[] = useAppSelector(
    (state) => state.result.data
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>("all");

  const totalRuns = results.length;
  const wins = results.filter((r) => r.gold_found && r.returned_home).length;
  const winRate = totalRuns === 0 ? 0 : Math.round((wins / totalRuns) * 100);

  const filteredResults = results.filter((r) => {
    if (filter === "success") {
      return r.gold_found && r.returned_home;
    }
    if (filter === "death") {
      return !!r.death_cause;
    }
    return true; // all
  });

  return (
    <Modal
      title="📜 Simulation History"
      open={show}
      footer={null}
      width={720}
      onCancel={() => setShow(false)}
    >
      <Card style={{ marginBottom: 20 }}>
        <Row gutter={24} align="middle">
          <Col span={8}>
            <Statistic title="Total Runs" value={totalRuns} />
          </Col>

          <Col span={8}>
            <Statistic title="Wins" value={wins} />
          </Col>

          <Col span={8}>
            <Statistic title="Win Rate" value={winRate} suffix="%" />
          </Col>
        </Row>

        <Progress
          percent={winRate}
          status={winRate >= 50 ? "success" : "normal"}
          style={{ marginTop: 16 }}
        />
      </Card>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <span style={{ fontWeight: 500 }}>Show:</span>

          <Radio.Group
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setCurrentPage(1); // reset page on filter change
            }}
          >
            <Radio.Button value="all">All</Radio.Button>
            <Radio.Button value="success">🏆 Success</Radio.Button>
            <Radio.Button value="death">☠️ Death</Radio.Button>
          </Radio.Group>
        </Space>
      </Card>
      {results.length === 0 ? (
        <Empty
          description="No simulations recorded yet"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <List
          dataSource={[...filteredResults].reverse()}
          itemLayout="vertical"
          pagination={{
            current: currentPage,
            pageSize: PAGE_SIZE,
            total: filteredResults.length,
            onChange: (page) => setCurrentPage(page),
            showSizeChanger: false,
            showLessItems: true,
            showQuickJumper: true,
          }}
          renderItem={(item, index) => {
            const success = item.gold_found && item.returned_home;

            return (
              <Card
                key={index}
                style={{ marginBottom: 16 }}
                variant="outlined"
                title={
                  <Space>
                    {success ? (
                      <Tag color="green">🏆 SUCCESS</Tag>
                    ) : (
                      <Tag color="red">☠️ FAILED</Tag>
                    )}
                    <span>Run #{item.runIndex}</span>
                  </Space>
                }
              >
                <Space size="large" wrap>
                  <Tag color="blue">Steps: {item.steps}</Tag>
                  <Tag color="purple">Arrows left: {item.arrows_left}</Tag>
                  <Tag color="gold">Gold: {item.gold_found ? "✔" : "✘"}</Tag>
                  <Tag color="cyan">
                    Returned home: {item.returned_home ? "✔" : "✘"}
                  </Tag>
                </Space>

                <Divider style={{ margin: "12px 0" }} />

                <Space size="large" wrap>
                  <Tag color="volcano">Wumpus killed: {item.wumpus_killed}</Tag>
                  <Tag color="geekblue">
                    Total arrows collected: {item.total_arrows_collected}
                  </Tag>
                </Space>

                {item.death_cause && (
                  <>
                    <Divider style={{ margin: "12px 0" }} />
                    <Tag color="red">
                      Death cause: {item.death_cause.toUpperCase()}
                    </Tag>
                  </>
                )}
              </Card>
            );
          }}
        />
      )}
    </Modal>
  );
};

export default HistoryResult;
